#include <Arduino.h>
#include <ArduinoJson.h>
#include <time.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/semphr.h"
#include "freertos/queue.h"

#include "config.h"
#include "log_serial.h"
#include "botao.h"
#include "wifi_mqtt.h"

// O SDK do ESP32 tem outros "config.h" no include path; checa por um define nosso.
#ifndef WIFI_SSID
#error "config.h nao encontrado: copie include/config.example.h para include/config.h e preencha"
#endif

// Contrato em docs/topicos-mqtt.md.
const char* MQTT_TOPIC = "grupo" NUMERO_GRUPO "/silo/evento";

// Antes disso o relógio ainda não foi acertado pelo NTP (2023-11-14).
#define TS_MINIMO_VALIDO 1700000000

Botao botaoEntrada = {"ENTRADA", BOTAO_ENTRADA_PIN, EVENTO_ENTRADA, NULL};
Botao botaoSaida   = {"SAIDA",   BOTAO_SAIDA_PIN,   EVENTO_SAIDA,   NULL};

void TaskComunicacao(void *pvParameters) {
    wifiMqttIniciar();

    EventoSilo ev;

    // Só esta task consome a fila, então os contadores não precisam de mutex.
    uint32_t entradas = 0;
    uint32_t saidas = 0;
    uint32_t seq = 0;

    for (;;) {
        verificarWiFi();
        verificarMQTT();

        if (!mqttConectado()) {
            // Sem broker os eventos esperam na fila (até FILA_TAMANHO) e saem em ordem na volta.
            vTaskDelay(pdMS_TO_TICKS(100));
            continue;
        }

        mqttLoop();

        // Peek em vez de receive: o evento só sai da fila depois de publicado,
        // então uma queda no meio da publicação não perde o evento.
        if (xQueuePeek(xFilaBotao, &ev, pdMS_TO_TICKS(100)) != pdPASS) {
            continue;
        }

        const char* tipo = NULL;
        uint32_t novasEntradas = entradas;
        uint32_t novasSaidas = saidas;

        if (ev.tipo == EVENTO_ENTRADA) {
            novasEntradas++;
            tipo = "ENTRADA";
        } else if (ev.tipo == EVENTO_SAIDA) {
            novasSaidas++;
            tipo = "SAIDA";
        }

        if (tipo == NULL) {
            xQueueReceive(xFilaBotao, &ev, 0);
            continue;
        }

        JsonDocument doc;
        doc["device_id"] = deviceId();
        if (ev.ts >= TS_MINIMO_VALIDO) {
            doc["ts"] = (uint32_t)ev.ts;
        } else {
            doc["ts"] = nullptr;
        }
        doc["seq"] = seq + 1;
        doc["evento"] = tipo;
        doc["entradas"] = novasEntradas;
        doc["saidas"] = novasSaidas;
        doc["saldo"] = (long)novasEntradas - (long)novasSaidas;

        char payload[160];
        serializeJson(doc, payload, sizeof(payload));

        if (mqttPublicar(MQTT_TOPIC, payload)) {
            xQueueReceive(xFilaBotao, &ev, 0);
            entradas = novasEntradas;
            saidas = novasSaidas;
            seq++;
            logSerial("[MQTT] Publicado em %s: %s\n", MQTT_TOPIC, payload);
        } else {
            // Continua na fila; sai na próxima volta, depois da reconexão.
            logSerial("[MQTT] Falha ao publicar. Evento mantido na fila.\n");
            vTaskDelay(pdMS_TO_TICKS(500));
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
    xFilaBotao = xQueueCreate(FILA_TAMANHO, sizeof(EventoSilo));

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
