#include "alerta.h"
#include "log_serial.h"

QueueHandle_t xFilaAlerta = NULL;

// Só a TaskSensores chama alertaAvaliar(), então o estado não precisa de mutex.
static bool estadoConhecido = false;  // false até a primeira leitura válida do DHT11
static bool ativo = false;
static uint32_t seq = 0;

void alertaIniciar() {
    pinMode(LED_ALERTA_PIN, OUTPUT);
    digitalWrite(LED_ALERTA_PIN, LOW);
}

void alertaAvaliar(const LeituraSilo *leitura) {
    // Leitura com falha não muda o estado.
    if (!leitura->dhtOk) {
        return;
    }

    bool acimaTemp = leitura->temperatura > ALERTA_TEMP_LIGA;
    bool acimaUmid = leitura->umidade > ALERTA_UMID_LIGA;

    bool novoAtivo;
    if (!estadoConhecido || !ativo) {
        novoAtivo = acimaTemp || acimaUmid;
    } else {
        // Entre os dois limiares o alerta continua ATIVO, para não piscar perto do limite.
        novoAtivo = !(leitura->temperatura < ALERTA_TEMP_DESLIGA && leitura->umidade < ALERTA_UMID_DESLIGA);
    }

    // A primeira leitura válida sempre publica, para substituir um alerta retido de antes do reboot.
    if (estadoConhecido && novoAtivo == ativo) {
        return;
    }
    estadoConhecido = true;
    ativo = novoAtivo;
    digitalWrite(LED_ALERTA_PIN, ativo ? HIGH : LOW);

    AlertaSilo a;
    a.seq = ++seq;
    a.ts = leitura->ts;
    a.ativo = ativo;
    a.motivoTemperatura = ativo && acimaTemp;
    a.motivoUmidade = ativo && acimaUmid;
    a.temperatura = leitura->temperatura;
    a.umidade = leitura->umidade;

    logSerial("[ALERTA] %s (temperatura=%d C umidade=%d%%)\n", ativo ? "ATIVO" : "NORMAL",
              a.temperatura, a.umidade);

    if (xQueueSend(xFilaAlerta, &a, 0) != pdPASS) {
        logSerial("[ERRO] Fila de alerta cheia. Mudanca %u descartada.\n", (unsigned)a.seq);
    }
}
