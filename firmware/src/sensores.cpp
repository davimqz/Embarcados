#include <Arduino.h>
#include <DHTesp.h>
#include <math.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

#include "config.h"  // pode sobrescrever SILO_DIST_VAZIO_CM / SILO_DIST_CHEIO_CM
#include "sensores.h"
#include "log_serial.h"

#define SONAR_AMOSTRAS 3          // mediana de 3 medidas descarta um eco perdido ou refletido
#define SONAR_PAUSA_MS 60         // o HC-SR04 pede >= 60 ms entre medidas, para o eco anterior sumir
#define SONAR_TIMEOUT_US 30000    // ~5 m de ida e volta; sem eco até lá, a medida falhou
#define SONAR_MIN_CM 2.0f         // abaixo disso o HC-SR04 não mede
#define SONAR_MAX_CM 400.0f

QueueHandle_t xFilaTelemetria = NULL;

static DHTesp dht;

void sensoresIniciar() {
    pinMode(SONAR_TRIG_PIN, OUTPUT);
    digitalWrite(SONAR_TRIG_PIN, LOW);
    pinMode(SONAR_ECHO_PIN, INPUT);
    dht.setup(DHT_PIN, DHTesp::DHT11);
}

// Uma medida em cm, ou NAN se não houve eco.
static float medirDistanciaCm() {
    // Pulso de 10 µs no TRIG: curto demais para vTaskDelay, que tem resolução de 1 ms.
    digitalWrite(SONAR_TRIG_PIN, HIGH);
    delayMicroseconds(10);
    digitalWrite(SONAR_TRIG_PIN, LOW);

    unsigned long us = pulseIn(SONAR_ECHO_PIN, HIGH, SONAR_TIMEOUT_US);
    if (us == 0) {
        return NAN;
    }
    // Som a ~343 m/s: 58 µs de ida e volta por cm.
    return us / 58.0f;
}

static float medianaDistanciaCm() {
    float medidas[SONAR_AMOSTRAS];
    int validas = 0;

    for (int i = 0; i < SONAR_AMOSTRAS; i++) {
        float cm = medirDistanciaCm();
        if (!isnan(cm) && cm >= SONAR_MIN_CM && cm <= SONAR_MAX_CM) {
            medidas[validas++] = cm;
        }
        vTaskDelay(pdMS_TO_TICKS(SONAR_PAUSA_MS));
    }

    if (validas == 0) {
        return NAN;
    }

    // Ordenação por inserção: no máximo 3 itens.
    for (int i = 1; i < validas; i++) {
        float v = medidas[i];
        int j = i - 1;
        while (j >= 0 && medidas[j] > v) {
            medidas[j + 1] = medidas[j];
            j--;
        }
        medidas[j + 1] = v;
    }
    return medidas[validas / 2];
}

static int calcularNivelPct(float distanciaCm) {
    float pct = (SILO_DIST_VAZIO_CM - distanciaCm) * 100.0f / (SILO_DIST_VAZIO_CM - SILO_DIST_CHEIO_CM);
    if (pct < 0.0f) {
        pct = 0.0f;
    } else if (pct > 100.0f) {
        pct = 100.0f;
    }
    return (int)lroundf(pct);
}

static void lerSensores(LeituraSilo *l) {
    l->ts = time(nullptr);

    TempAndHumidity th = dht.getTempAndHumidity();
    l->dhtOk = dht.getStatus() == DHTesp::ERROR_NONE && !isnan(th.temperature) && !isnan(th.humidity);
    l->temperatura = l->dhtOk ? (int)lroundf(th.temperature) : 0;
    l->umidade = l->dhtOk ? (int)lroundf(th.humidity) : 0;
    if (!l->dhtOk) {
        logSerial("[SENSOR] Falha no DHT11: %s\n", dht.getStatusString());
    }

    float cm = medianaDistanciaCm();
    l->sonarOk = !isnan(cm);
    // 1 casa decimal, como no contrato; a resolução do HC-SR04 é ~3 mm.
    l->distanciaCm = l->sonarOk ? roundf(cm * 10.0f) / 10.0f : 0.0f;
    l->nivelPct = l->sonarOk ? calcularNivelPct(l->distanciaCm) : 0;
    if (!l->sonarOk) {
        logSerial("[SENSOR] Falha no HC-SR04: sem eco valido.\n");
    }
}

void TaskSensores(void *pvParameters) {
    LeituraSilo leitura;
    bool folgaRegistrada = false;
    uint32_t seq = 0;

    // Período fixo pelo relógio do RTOS: o tempo gasto na leitura (~200 ms) não acumula atraso.
    TickType_t proximaLeitura = xTaskGetTickCount();

    for (;;) {
        lerSensores(&leitura);
        leitura.seq = ++seq;

        char temp[8] = "falha";
        char umid[8] = "falha";
        char dist[12] = "falha";
        char nivel[8] = "falha";
        if (leitura.dhtOk) {
            snprintf(temp, sizeof(temp), "%d C", leitura.temperatura);
            snprintf(umid, sizeof(umid), "%d%%", leitura.umidade);
        }
        if (leitura.sonarOk) {
            snprintf(dist, sizeof(dist), "%.1f cm", leitura.distanciaCm);
            snprintf(nivel, sizeof(nivel), "%d%%", leitura.nivelPct);
        }
        logSerial("[SENSOR] seq=%u temperatura=%s umidade=%s distancia=%s nivel=%s\n",
                  (unsigned)leitura.seq, temp, umid, dist, nivel);

        // Fila cheia (broker fora há mais de 1 min): descarta a leitura nova, e o buraco aparece no seq.
        if (xQueueSend(xFilaTelemetria, &leitura, 0) != pdPASS) {
            logSerial("[ERRO] Fila de telemetria cheia. Leitura %u descartada.\n", (unsigned)leitura.seq);
        }

        // Uma vez só, depois da primeira leitura completa: quanto do stack nunca foi usado.
        if (!folgaRegistrada) {
            folgaRegistrada = true;
            logSerial("[SENSOR] Folga de stack da TaskSensores: %u bytes\n",
                      (unsigned)uxTaskGetStackHighWaterMark(NULL));
        }

        vTaskDelayUntil(&proximaLeitura, pdMS_TO_TICKS(LEITURA_INTERVALO_MS));
    }
}
