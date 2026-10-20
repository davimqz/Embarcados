#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/semphr.h"
#include "freertos/queue.h"

#include "config.h"

// O SDK do ESP32 tem outros "config.h" no include path; checa por um define nosso.
#ifndef WIFI_SSID
#error "config.h nao encontrado: copie include/config.example.h para include/config.h e preencha"
#endif

const char* MQTT_TOPIC = "/botao/status";

// Botões ligados entre o GPIO e o GND (INPUT_PULLUP).
#define BOTAO_ENTRADA_PIN 19   // amarelo: entrada de lote no silo
#define BOTAO_SAIDA_PIN   21   // vermelho: saída de lote do silo

#define FILA_TAMANHO 10
#define DEBOUNCE_MS 200
#define CONFIRMA_MS 50          // o pino precisa ficar em LOW esse tempo todo para contar
#define IGNORAR_INICIO_MS 2000  // o D19 vai a LOW sozinho logo após o boot; ignora esse período

// Valores trafegados na fila.
#define EVENTO_ENTRADA 1
#define EVENTO_SAIDA   2

WiFiClient wifiClient;
PubSubClient mqtt(wifiClient);

QueueHandle_t xFilaBotao = NULL;
SemaphoreHandle_t xMutexSerial = NULL;

// Serial compartilhado entre tasks dos dois núcleos: monta a mensagem inteira
// num buffer local e só então escreve, segurando o mutex, para as linhas não se misturarem.
void logSerial(const char* fmt, ...) {
    char buf[160];
    va_list args;
    va_start(args, fmt);
    vsnprintf(buf, sizeof(buf), fmt, args);
    va_end(args);

    if (xMutexSerial != NULL) {
        xSemaphoreTake(xMutexSerial, portMAX_DELAY);
    }
    Serial.print(buf);
    if (xMutexSerial != NULL) {
        xSemaphoreGive(xMutexSerial);
    }
}

struct Botao {
    const char* nome;
    uint8_t pino;
    int evento;
    SemaphoreHandle_t sem;
};

Botao botaoEntrada = {"ENTRADA", BOTAO_ENTRADA_PIN, EVENTO_ENTRADA, NULL};
Botao botaoSaida   = {"SAIDA",   BOTAO_SAIDA_PIN,   EVENTO_SAIDA,   NULL};

// Sem trava de tempo aqui: um pulso de ruído não pode bloquear o aperto real que vem logo depois.
// Quem filtra é a TaskBotao (confirmarAperto + espera de DEBOUNCE_MS após soltar).
void IRAM_ATTR isrBotao(void *arg) {
    Botao *b = (Botao *)arg;
    BaseType_t tarefaDespertada = pdFALSE;
    xSemaphoreGiveFromISR(b->sem, &tarefaDespertada);

    if (tarefaDespertada == pdTRUE) {
        portYIELD_FROM_ISR();
    }
}

// Marcado no fim do setup(); eventos antes de IGNORAR_INICIO_MS a partir daqui são descartados.
volatile TickType_t tickInicio = 0;

// Amostra o pino a cada 5 ms; um único HIGH na janela descarta o evento (toque acidental ou ruído).
bool confirmarAperto(uint8_t pino) {
    for (int i = 0; i < CONFIRMA_MS / 5; i++) {
        if (digitalRead(pino) != LOW) {
            return false;
        }
        vTaskDelay(pdMS_TO_TICKS(5));
    }
    return true;
}

void TaskBotao(void *pvParameters) {
    Botao *b = (Botao *)pvParameters;

    for (;;) {
        if (xSemaphoreTake(b->sem, portMAX_DELAY) == pdTRUE) {
            if ((TickType_t)(xTaskGetTickCount() - tickInicio) < pdMS_TO_TICKS(IGNORAR_INICIO_MS)) {
                continue;
            }

            // Ruído é descartado em silêncio.
            if (!confirmarAperto(b->pino)) {
                continue;
            }

            if (xQueueSend(xFilaBotao, &b->evento, pdMS_TO_TICKS(10)) == pdPASS) {
                logSerial("[BOTAO] %s pressionado: evento enviado para a fila.\n", b->nome);
            } else {
                logSerial("[ERRO] Fila cheia. Evento descartado.\n");
            }

            while (digitalRead(b->pino) == LOW) {
                vTaskDelay(pdMS_TO_TICKS(10));
            }

            vTaskDelay(pdMS_TO_TICKS(DEBOUNCE_MS));
            xSemaphoreTake(b->sem, 0);
        }
    }
}

bool conectarWiFi() {
    if (WiFi.status() == WL_CONNECTED) {
        return true;
    }

    logSerial("[WiFi] Conectando a %s...\n", WIFI_SSID);

    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    int tentativas = 0;
    while (WiFi.status() != WL_CONNECTED) {
        vTaskDelay(pdMS_TO_TICKS(500));

        // A cada 5 s mostra o motivo: 1 = rede nao encontrada, 4 = falha (senha), 6 = desconectado.
        if (++tentativas % 10 == 0) {
            logSerial("[WiFi] Ainda conectando, status = %d\n", WiFi.status());
        }
    }

    logSerial("[WiFi] Conectado. IP local: %s\n", WiFi.localIP().toString().c_str());

    return true;
}

bool conectarMQTT() {
    if (mqtt.connected()) {
        return true;
    }

    String clientId = "ESP32-GRUPO" NUMERO_GRUPO "-" + String((uint32_t)ESP.getEfuseMac(), HEX);

    while (WiFi.status() == WL_CONNECTED && !mqtt.connected()) {
        logSerial("[MQTT] Conectando ao broker: %s\n", MQTT_BROKER);

        if (mqtt.connect(clientId.c_str())) {
            logSerial("[MQTT] Conectado ao broker.\n");
            return true;
        }

        logSerial("[MQTT] Falha na conexao. Estado: %d\n", mqtt.state());

        vTaskDelay(pdMS_TO_TICKS(2000));
    }

    return mqtt.connected();
}

void TaskComunicacao(void *pvParameters) {
    mqtt.setServer(MQTT_BROKER, MQTT_PORT);
    mqtt.setSocketTimeout(3);
    mqtt.setKeepAlive(30);

    int valorRecebido;

    // Só esta task consome a fila, então os contadores não precisam de mutex.
    uint32_t entradas = 0;
    uint32_t saidas = 0;

    for (;;) {
        if (WiFi.status() != WL_CONNECTED) {
            logSerial("[WiFi] Sem conexao.\n");
            conectarWiFi();
        }

        if (!mqtt.connected()) {
            conectarMQTT();
        }

        if (mqtt.connected()) {
            mqtt.loop();
        }

        if (xQueueReceive(xFilaBotao, &valorRecebido, pdMS_TO_TICKS(100)) == pdPASS) {
            const char* tipo = NULL;

            if (valorRecebido == EVENTO_ENTRADA) {
                entradas++;
                tipo = "ENTRADA";
            } else if (valorRecebido == EVENTO_SAIDA) {
                saidas++;
                tipo = "SAIDA";
            }

            if (tipo != NULL) {
                // Ex.: "ENTRADA-GRUPO3 entradas=5 saidas=2 saldo=3"
                char payload[96];
                snprintf(payload, sizeof(payload), "%s-GRUPO%s entradas=%lu saidas=%lu saldo=%ld",
                         tipo, NUMERO_GRUPO, (unsigned long)entradas, (unsigned long)saidas,
                         (long)entradas - (long)saidas);

                logSerial("[SILO] %s\n", payload);

                conectarWiFi();
                conectarMQTT();

                if (mqtt.connected()) {
                    if (mqtt.publish(MQTT_TOPIC, payload)) {
                        logSerial("[MQTT] Publicado em %s: %s\n", MQTT_TOPIC, payload);
                    } else {
                        logSerial("[MQTT] Falha ao publicar mensagem.\n");
                    }
                } else {
                    logSerial("[MQTT] Broker indisponivel. Evento nao publicado.\n");
                }
            }
        }

        vTaskDelay(pdMS_TO_TICKS(10));
    }
}

void travar(const char* msg) {
    logSerial("%s\n", msg);
    while (true) {
        vTaskDelay(pdMS_TO_TICKS(1000));
    }
}

void setup() {
    Serial.begin(9600);
    delay(1000);

    // Criado antes de qualquer task, para todas já encontrarem o mutex pronto.
    xMutexSerial = xSemaphoreCreateMutex();

    pinMode(BOTAO_ENTRADA_PIN, INPUT_PULLUP);
    pinMode(BOTAO_SAIDA_PIN, INPUT_PULLUP);

    botaoEntrada.sem = xSemaphoreCreateBinary();
    botaoSaida.sem = xSemaphoreCreateBinary();
    xFilaBotao = xQueueCreate(FILA_TAMANHO, sizeof(int));

    if (xMutexSerial == NULL || botaoEntrada.sem == NULL || botaoSaida.sem == NULL || xFilaBotao == NULL) {
        travar("[ERRO] Falha ao criar semaforos ou fila.");
    }

    if (xTaskCreatePinnedToCore(TaskBotao, "TaskBotaoEntrada", 3072, &botaoEntrada, 2, NULL, 1) != pdPASS ||
        xTaskCreatePinnedToCore(TaskBotao, "TaskBotaoSaida", 3072, &botaoSaida, 2, NULL, 1) != pdPASS) {
        travar("[ERRO] Falha ao criar tasks dos botoes.");
    }

    if (xTaskCreatePinnedToCore(TaskComunicacao, "TaskComunicacao", 8192, NULL, 1, NULL, 0) != pdPASS) {
        travar("[ERRO] Falha ao criar TaskComunicacao.");
    }

    tickInicio = xTaskGetTickCount();

    attachInterruptArg(digitalPinToInterrupt(BOTAO_ENTRADA_PIN), isrBotao, &botaoEntrada, FALLING);
    attachInterruptArg(digitalPinToInterrupt(BOTAO_SAIDA_PIN), isrBotao, &botaoSaida, FALLING);

    logSerial("[APP] Sistema iniciado com FreeRTOS.\n");
}

void loop() {
    vTaskDelay(pdMS_TO_TICKS(1000));
}