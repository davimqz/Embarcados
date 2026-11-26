#include <ArduinoJson.h>
#include "freertos/task.h"

#include "atuador.h"
#include "log_serial.h"
#include "wifi_mqtt.h"

QueueHandle_t xFilaComando = NULL;
QueueHandle_t xFilaVentilacao = NULL;

void atuadorIniciar() {
    pinMode(LED_VENTILACAO_PIN, OUTPUT);
    digitalWrite(LED_VENTILACAO_PIN, LOW);
}

void atuadorReceberComando(char* topico, uint8_t* payload, unsigned int tamanho) {
    JsonDocument doc;
    // O payload do PubSubClient não termina em '\0'; o tamanho vai junto.
    DeserializationError erro = deserializeJson(doc, payload, tamanho);
    if (erro) {
        logSerial("[CMD] Descartado: JSON invalido (%s).\n", erro.c_str());
        return;
    }

    const char* destino = doc["device_id"];
    if (destino == nullptr || strcmp(destino, deviceId()) != 0) {
        logSerial("[CMD] Descartado: device_id de outra placa.\n");
        return;
    }

    if (!doc["seq"].is<uint32_t>()) {
        logSerial("[CMD] Descartado: seq ausente ou invalido.\n");
        return;
    }

    const char* comando = doc["comando"];
    if (comando == nullptr || strcmp(comando, "VENTILACAO") != 0) {
        logSerial("[CMD] Descartado: comando desconhecido.\n");
        return;
    }

    const char* valor = doc["valor"];
    ComandoVentilacao cmd;
    cmd.cmdSeq = doc["seq"].as<uint32_t>();
    if (valor != nullptr && strcmp(valor, "LIGAR") == 0) {
        cmd.ligar = true;
    } else if (valor != nullptr && strcmp(valor, "DESLIGAR") == 0) {
        cmd.ligar = false;
    } else {
        logSerial("[CMD] Descartado: valor desconhecido.\n");
        return;
    }

    if (xQueueSend(xFilaComando, &cmd, 0) == pdPASS) {
        logSerial("[CMD] Recebido: VENTILACAO %s (seq %u)\n", cmd.ligar ? "LIGAR" : "DESLIGAR",
                  (unsigned)cmd.cmdSeq);
    } else {
        logSerial("[ERRO] Fila de comandos cheia. Comando %u descartado.\n", (unsigned)cmd.cmdSeq);
    }
}

static void confirmarEstado(EstadoVentilacao *est) {
    est->seq++;
    est->ts = time(nullptr);
    if (xQueueSend(xFilaVentilacao, est, 0) != pdPASS) {
        logSerial("[ERRO] Fila de ventilacao cheia. Estado %u descartado.\n", (unsigned)est->seq);
    }
}

void TaskAtuador(void *pvParameters) {
    EstadoVentilacao est = {0, 0, false, false, 0};

    // Ventilação sempre começa desligada; o estado do boot vai sem cmd_seq.
    confirmarEstado(&est);

    ComandoVentilacao cmd;
    for (;;) {
        if (xQueueReceive(xFilaComando, &cmd, portMAX_DELAY) != pdPASS) {
            continue;
        }

        digitalWrite(LED_VENTILACAO_PIN, cmd.ligar ? HIGH : LOW);
        logSerial("[ATUADOR] Ventilacao %s.\n", cmd.ligar ? "LIGADA" : "DESLIGADA");

        // Confirma mesmo sem mudança de estado: o backend espera o cmd_seq de volta.
        est.ligada = cmd.ligar;
        est.temCmd = true;
        est.cmdSeq = cmd.cmdSeq;
        confirmarEstado(&est);
    }
}
