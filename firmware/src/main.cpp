#include <Arduino.h>
#include <ArduinoJson.h>
#include <math.h>
#include <time.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/semphr.h"
#include "freertos/queue.h"

#include "config.h"
#include "log_serial.h"
#include "botao.h"
#include "wifi_mqtt.h"
#include "sensores.h"
#include "alerta.h"
#include "atuador.h"

// O SDK do ESP32 tem outros "config.h" no include path; checa por um define nosso.
#ifndef WIFI_SSID
#error "config.h nao encontrado: copie include/config.example.h para include/config.h e preencha"
#endif

// Contrato em docs/topicos-mqtt.md.
const char* MQTT_TOPIC = "grupo" NUMERO_GRUPO "/silo/evento";
const char* MQTT_TOPIC_TELEMETRIA = "grupo" NUMERO_GRUPO "/telemetria";
const char* MQTT_TOPIC_ALERTA = "grupo" NUMERO_GRUPO "/alerta";
const char* MQTT_TOPIC_CMD = "grupo" NUMERO_GRUPO "/cmd";
const char* MQTT_TOPIC_VENTILACAO = "grupo" NUMERO_GRUPO "/ventilacao";

// Antes disso o relógio ainda não foi acertado pelo NTP (2023-11-14).
#define TS_MINIMO_VALIDO 1700000000

Botao botaoEntrada = {"ENTRADA", BOTAO_ENTRADA_PIN, EVENTO_ENTRADA, NULL};
Botao botaoSaida   = {"SAIDA",   BOTAO_SAIDA_PIN,   EVENTO_SAIDA,   NULL};

// Só a TaskComunicacao consome as filas, então os contadores não precisam de mutex.
struct EstadoEventos {
    uint32_t entradas;
    uint32_t saidas;
    uint32_t seq;
};

static void preencherTs(JsonDocument &doc, time_t ts) {
    if (ts >= TS_MINIMO_VALIDO) {
        doc["ts"] = (uint32_t)ts;
    } else {
        doc["ts"] = nullptr;
    }
}

// Publica o evento mais antigo da fila dos botões. Retorna false se a fila estava vazia.
static bool publicarEventoBotao(EstadoEventos *est) {
    EventoSilo ev;

    // Peek em vez de receive: o evento só sai da fila depois de publicado,
    // então uma queda no meio da publicação não perde o evento.
    if (xQueuePeek(xFilaBotao, &ev, 0) != pdPASS) {
        return false;
    }

    const char* tipo = NULL;
    uint32_t novasEntradas = est->entradas;
    uint32_t novasSaidas = est->saidas;

    if (ev.tipo == EVENTO_ENTRADA) {
        novasEntradas++;
        tipo = "ENTRADA";
    } else if (ev.tipo == EVENTO_SAIDA) {
        novasSaidas++;
        tipo = "SAIDA";
    }

    if (tipo == NULL) {
        xQueueReceive(xFilaBotao, &ev, 0);
        return true;
    }

    JsonDocument doc;
    doc["device_id"] = deviceId();
    preencherTs(doc, ev.ts);
    doc["seq"] = est->seq + 1;
    doc["evento"] = tipo;
    doc["entradas"] = novasEntradas;
    doc["saidas"] = novasSaidas;
    doc["saldo"] = (long)novasEntradas - (long)novasSaidas;

    char payload[160];
    serializeJson(doc, payload, sizeof(payload));

    if (mqttPublicar(MQTT_TOPIC, payload)) {
        xQueueReceive(xFilaBotao, &ev, 0);
        est->entradas = novasEntradas;
        est->saidas = novasSaidas;
        est->seq++;
        logSerial("[MQTT] Publicado em %s: %s\n", MQTT_TOPIC, payload);
    } else {
        // Continua na fila; sai na próxima volta, depois da reconexão.
        logSerial("[MQTT] Falha ao publicar. Evento mantido na fila.\n");
        vTaskDelay(pdMS_TO_TICKS(500));
    }
    return true;
}

// Publica a leitura mais antiga da fila de telemetria. Retorna false se a fila estava vazia.
static bool publicarTelemetria() {
    LeituraSilo l;

    // Mesmo esquema dos botões: a leitura só sai da fila depois de publicada.
    if (xQueuePeek(xFilaTelemetria, &l, 0) != pdPASS) {
        return false;
    }

    JsonDocument doc;
    doc["device_id"] = deviceId();
    preencherTs(doc, l.ts);
    doc["seq"] = l.seq;  // numerado pela TaskSensores na leitura
    if (l.dhtOk) {
        doc["temperatura"] = l.temperatura;
        doc["umidade"] = l.umidade;
    } else {
        doc["temperatura"] = nullptr;
        doc["umidade"] = nullptr;
    }
    if (l.sonarOk) {
        // Arredondado em double: o float 5.8f sairia como 5.800000191 no JSON.
        doc["distancia_cm"] = round(l.distanciaCm * 10.0) / 10.0;
        doc["nivel_pct"] = l.nivelPct;
    } else {
        doc["distancia_cm"] = nullptr;
        doc["nivel_pct"] = nullptr;
    }

    char payload[200];
    serializeJson(doc, payload, sizeof(payload));

    if (mqttPublicar(MQTT_TOPIC_TELEMETRIA, payload)) {
        xQueueReceive(xFilaTelemetria, &l, 0);
        logSerial("[MQTT] Publicado em %s: %s\n", MQTT_TOPIC_TELEMETRIA, payload);
    } else {
        logSerial("[MQTT] Falha ao publicar. Leitura mantida na fila.\n");
        vTaskDelay(pdMS_TO_TICKS(500));
    }
    return true;
}

// Publica a mudança de estado do alerta mais antiga da fila (retida). Retorna false se a fila estava vazia.
static bool publicarAlerta() {
    AlertaSilo a;

    if (xQueuePeek(xFilaAlerta, &a, 0) != pdPASS) {
        return false;
    }

    JsonDocument doc;
    doc["device_id"] = deviceId();
    preencherTs(doc, a.ts);
    doc["seq"] = a.seq;
    doc["alerta"] = a.ativo ? "ATIVO" : "NORMAL";
    JsonArray motivos = doc["motivos"].to<JsonArray>();
    if (a.motivoTemperatura) {
        motivos.add("TEMPERATURA");
    }
    if (a.motivoUmidade) {
        motivos.add("UMIDADE");
    }
    doc["temperatura"] = a.temperatura;
    doc["umidade"] = a.umidade;

    char payload[200];
    serializeJson(doc, payload, sizeof(payload));

    // Retido: quem assinar depois recebe o estado atual do alerta na hora.
    if (mqttPublicar(MQTT_TOPIC_ALERTA, payload, true)) {
        xQueueReceive(xFilaAlerta, &a, 0);
        logSerial("[MQTT] Publicado em %s: %s\n", MQTT_TOPIC_ALERTA, payload);
    } else {
        logSerial("[MQTT] Falha ao publicar. Alerta mantido na fila.\n");
        vTaskDelay(pdMS_TO_TICKS(500));
    }
    return true;
}

// Publica o estado do LED de ventilação mais antigo da fila (retido). Retorna false se a fila estava vazia.
static bool publicarVentilacao() {
    EstadoVentilacao est;

    if (xQueuePeek(xFilaVentilacao, &est, 0) != pdPASS) {
        return false;
    }

    JsonDocument doc;
    doc["device_id"] = deviceId();
    preencherTs(doc, est.ts);
    doc["seq"] = est.seq;
    doc["ventilacao"] = est.ligada ? "LIGADA" : "DESLIGADA";
    if (est.temCmd) {
        doc["cmd_seq"] = est.cmdSeq;
    } else {
        doc["cmd_seq"] = nullptr;
    }

    char payload[160];
    serializeJson(doc, payload, sizeof(payload));

    // Retido: o dashboard sabe o estado do LED assim que assina.
    if (mqttPublicar(MQTT_TOPIC_VENTILACAO, payload, true)) {
        xQueueReceive(xFilaVentilacao, &est, 0);
        logSerial("[MQTT] Publicado em %s: %s\n", MQTT_TOPIC_VENTILACAO, payload);
    } else {
        logSerial("[MQTT] Falha ao publicar. Estado da ventilacao mantido na fila.\n");
        vTaskDelay(pdMS_TO_TICKS(500));
    }
    return true;
}

void TaskComunicacao(void *pvParameters) {
    wifiMqttIniciar();
    mqttAssinar(MQTT_TOPIC_CMD, atuadorReceberComando);

    EstadoEventos eventos = {0, 0, 0};

    for (;;) {
        verificarWiFi();
        verificarMQTT();

        if (!mqttConectado()) {
            // Sem broker os eventos e as leituras esperam nas filas e saem em ordem na volta.
            vTaskDelay(pdMS_TO_TICKS(100));
            continue;
        }

        mqttLoop();

        // Botões primeiro: um aperto não espera as leituras acumuladas de uma queda.
        // O alerta vem antes da telemetria pelo mesmo motivo.
        bool publicou = publicarEventoBotao(&eventos);
        if (!publicou) {
            publicou = publicarAlerta();
        }
        if (!publicou) {
            publicou = publicarVentilacao();
        }
        if (!publicou) {
            publicou = publicarTelemetria();
        }

        // Com as filas vazias, dorme mais; com fila, segue esvaziando.
        vTaskDelay(pdMS_TO_TICKS(publicou ? 10 : 50));
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
    sensoresIniciar();
    alertaIniciar();
    atuadorIniciar();

    botaoEntrada.sem = xSemaphoreCreateBinary();
    botaoSaida.sem = xSemaphoreCreateBinary();
    xFilaBotao = xQueueCreate(FILA_TAMANHO, sizeof(EventoSilo));
    xFilaTelemetria = xQueueCreate(FILA_TELEMETRIA_TAMANHO, sizeof(LeituraSilo));
    xFilaAlerta = xQueueCreate(FILA_ALERTA_TAMANHO, sizeof(AlertaSilo));
    xFilaComando = xQueueCreate(FILA_COMANDO_TAMANHO, sizeof(ComandoVentilacao));
    xFilaVentilacao = xQueueCreate(FILA_VENTILACAO_TAMANHO, sizeof(EstadoVentilacao));

    if (xMutexSerial == NULL || botaoEntrada.sem == NULL || botaoSaida.sem == NULL || xFilaBotao == NULL ||
        xFilaTelemetria == NULL || xFilaAlerta == NULL || xFilaComando == NULL || xFilaVentilacao == NULL) {
        travar("[ERRO] Falha ao criar semaforos ou fila.");
    }

    if (xTaskCreatePinnedToCore(TaskBotao, "TaskBotaoEntrada", 3072, &botaoEntrada, 2, NULL, 1) != pdPASS ||
        xTaskCreatePinnedToCore(TaskBotao, "TaskBotaoSaida", 3072, &botaoSaida, 2, NULL, 1) != pdPASS) {
        travar("[ERRO] Falha ao criar tasks dos botoes.");
    }

    if (xTaskCreatePinnedToCore(TaskComunicacao, "TaskComunicacao", 8192, NULL, 1, NULL, 0) != pdPASS) {
        travar("[ERRO] Falha ao criar TaskComunicacao.");
    }

    // Abaixo dos botões, para um aperto nunca esperar uma leitura; no núcleo 1, longe do Wi-Fi.
    if (xTaskCreatePinnedToCore(TaskSensores, "TaskSensores", 4096, NULL, 1, NULL, 1) != pdPASS) {
        travar("[ERRO] Falha ao criar TaskSensores.");
    }

    // Trabalho mínimo (um digitalWrite por comando); a latência vem da rede, então fica abaixo dos botões.
    if (xTaskCreatePinnedToCore(TaskAtuador, "TaskAtuador", 3072, NULL, 1, NULL, 1) != pdPASS) {
        travar("[ERRO] Falha ao criar TaskAtuador.");
    }

    tickInicio = xTaskGetTickCount();

    attachInterruptArg(digitalPinToInterrupt(BOTAO_ENTRADA_PIN), isrBotao, &botaoEntrada, FALLING);
    attachInterruptArg(digitalPinToInterrupt(BOTAO_SAIDA_PIN), isrBotao, &botaoSaida, FALLING);

    logSerial("[APP] Sistema iniciado com FreeRTOS.\n");
}

void loop() {
    vTaskDelay(pdMS_TO_TICKS(1000));
}
