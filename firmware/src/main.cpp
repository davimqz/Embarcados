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

const char* MQTT_PAYLOAD = "ON-GRUPO" NUMERO_GRUPO;

#define BOTAO_PIN 27
#define FILA_TAMANHO 10
#define DEBOUNCE_MS 200

WiFiClient wifiClient;
PubSubClient mqtt(wifiClient);

SemaphoreHandle_t xSemBotao = NULL;
QueueHandle_t xFilaBotao = NULL;

volatile TickType_t ultimoTickISR = 0;

void IRAM_ATTR isrBotao() {
    TickType_t agora = xTaskGetTickCountFromISR();

    if ((TickType_t)(agora - ultimoTickISR) < pdMS_TO_TICKS(DEBOUNCE_MS)) {
        return;
    }

    ultimoTickISR = agora;

    BaseType_t tarefaDespertada = pdFALSE;
    xSemaphoreGiveFromISR(xSemBotao, &tarefaDespertada);

    if (tarefaDespertada == pdTRUE) {
        portYIELD_FROM_ISR();
    }
}

void TaskBotao(void *pvParameters) {
    const int valor = 1;

    for (;;) {
        if (xSemaphoreTake(xSemBotao, portMAX_DELAY) == pdTRUE) {
            vTaskDelay(pdMS_TO_TICKS(20));

            if (digitalRead(BOTAO_PIN) == LOW) {
                if (xQueueSend(xFilaBotao, &valor, pdMS_TO_TICKS(10)) == pdPASS) {
                    Serial.println("[BOTAO] Pressionado: valor 1 enviado para a fila.");
                } else {
                    Serial.println("[ERRO] Fila cheia. Evento descartado.");
                }

                while (digitalRead(BOTAO_PIN) == LOW) {
                    vTaskDelay(pdMS_TO_TICKS(10));
                }

                vTaskDelay(pdMS_TO_TICKS(DEBOUNCE_MS));
                xSemaphoreTake(xSemBotao, 0);
            }
        }
    }
}

bool conectarWiFi() {
    if (WiFi.status() == WL_CONNECTED) {
        return true;
    }

    Serial.print("[WiFi] Conectando");

    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    while (WiFi.status() != WL_CONNECTED) {
        Serial.print(".");
        vTaskDelay(pdMS_TO_TICKS(500));
    }

    Serial.println();
    Serial.print("[WiFi] Conectado. IP local: ");
    Serial.println(WiFi.localIP());

    return true;
}

bool conectarMQTT() {
    if (mqtt.connected()) {
        return true;
    }

    String clientId = "ESP32-GRUPO" NUMERO_GRUPO "-" + String((uint32_t)ESP.getEfuseMac(), HEX);

    while (WiFi.status() == WL_CONNECTED && !mqtt.connected()) {
        Serial.print("[MQTT] Conectando ao broker: ");
        Serial.println(MQTT_BROKER);

        if (mqtt.connect(clientId.c_str())) {
            Serial.println("[MQTT] Conectado ao broker.");
            return true;
        }

        Serial.print("[MQTT] Falha na conexao. Estado: ");
        Serial.println(mqtt.state());

        vTaskDelay(pdMS_TO_TICKS(2000));
    }

    return mqtt.connected();
}

void TaskComunicacao(void *pvParameters) {
    mqtt.setServer(MQTT_BROKER, MQTT_PORT);
    mqtt.setSocketTimeout(3);
    mqtt.setKeepAlive(30);

    int valorRecebido;

    for (;;) {
        if (WiFi.status() != WL_CONNECTED) {
            Serial.println("[WiFi] Conexao perdida.");
            conectarWiFi();
        }

        if (!mqtt.connected()) {
            conectarMQTT();
        }

        if (mqtt.connected()) {
            mqtt.loop();
        }

        if (xQueueReceive(xFilaBotao, &valorRecebido, pdMS_TO_TICKS(100)) == pdPASS) {
            if (valorRecebido == 1) {
                conectarWiFi();
                conectarMQTT();

                if (mqtt.connected()) {
                    if (mqtt.publish(MQTT_TOPIC, MQTT_PAYLOAD)) {
                        Serial.print("[MQTT] Publicado em ");
                        Serial.print(MQTT_TOPIC);
                        Serial.print(": ");
                        Serial.println(MQTT_PAYLOAD);
                    } else {
                        Serial.println("[MQTT] Falha ao publicar mensagem.");
                    }
                } else {
                    Serial.println("[MQTT] Broker indisponivel. Evento nao publicado.");
                }
            }
        }

        vTaskDelay(pdMS_TO_TICKS(10));
    }
}

void travar(const char* msg) {
    Serial.println(msg);
    while (true) {
        vTaskDelay(pdMS_TO_TICKS(1000));
    }
}

void setup() {
    Serial.begin(9600);
    delay(1000);

    pinMode(BOTAO_PIN, INPUT_PULLUP);

    xSemBotao = xSemaphoreCreateBinary();
    xFilaBotao = xQueueCreate(FILA_TAMANHO, sizeof(int));

    if (xSemBotao == NULL || xFilaBotao == NULL) {
        travar("[ERRO] Falha ao criar semaforo ou fila.");
    }

    if (xTaskCreatePinnedToCore(TaskBotao, "TaskBotao", 3072, NULL, 2, NULL, 1) != pdPASS) {
        travar("[ERRO] Falha ao criar TaskBotao.");
    }

    if (xTaskCreatePinnedToCore(TaskComunicacao, "TaskComunicacao", 8192, NULL, 1, NULL, 0) != pdPASS) {
        travar("[ERRO] Falha ao criar TaskComunicacao.");
    }

    attachInterrupt(digitalPinToInterrupt(BOTAO_PIN), isrBotao, FALLING);

    Serial.println("[APP] Sistema iniciado com FreeRTOS.");
}

void loop() {
    vTaskDelay(pdMS_TO_TICKS(1000));
}