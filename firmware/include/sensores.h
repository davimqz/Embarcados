#pragma once

#include <Arduino.h>
#include <time.h>
#include "freertos/FreeRTOS.h"
#include "freertos/queue.h"

// Pinagem em docs/arquitetura.md §2.
#define DHT_PIN       4    // DATA do módulo DHT11 (o módulo já tem o pull-up)
#define SONAR_TRIG_PIN 26  // TRIG do HC-SR04
#define SONAR_ECHO_PIN 27  // ECHO do HC-SR04, pelo divisor de tensão (5 V → 3,3 V)

#define LEITURA_INTERVALO_MS 5000  // decisão 4 de docs/decisoes-pendentes.md
#define FILA_TELEMETRIA_TAMANHO 12  // 1 min de leituras guardadas enquanto o broker está fora

// Distâncias do HC-SR04 (na tampa) até a superfície do grão com o silo vazio e cheio.
// Valores nominais do modelo 3D; calibrar na montagem, sobrescrevendo no config.h.
#ifndef SILO_DIST_VAZIO_CM
#define SILO_DIST_VAZIO_CM 12.0f
#endif
#ifndef SILO_DIST_CHEIO_CM
#define SILO_DIST_CHEIO_CM 3.0f
#endif

// Uma leitura dos sensores. O ts é o da leitura, não o da publicação.
struct LeituraSilo {
    uint32_t seq;        // numerado na leitura: uma leitura descartada vira buraco no seq publicado
    time_t ts;
    bool dhtOk;          // false: temperatura e umidade inválidas
    int temperatura;     // °C (o DHT11 tem passo de 1 °C)
    int umidade;         // % de umidade relativa
    bool sonarOk;        // false: distância e nível inválidos (sem eco ou fora da faixa)
    float distanciaCm;
    int nivelPct;        // 0 (vazio) a 100 (cheio)
};

// Fila de leituras da TaskSensores para a TaskComunicacao; criada no setup().
extern QueueHandle_t xFilaTelemetria;

// Configura os pinos e o DHT11; chamado no setup(), antes de criar a TaskSensores.
void sensoresIniciar();

// Lê o DHT11 e o HC-SR04 a cada LEITURA_INTERVALO_MS e põe a leitura na xFilaTelemetria.
void TaskSensores(void *pvParameters);
