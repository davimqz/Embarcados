#pragma once

#include <Arduino.h>
#include <time.h>
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"
#include "freertos/queue.h"

// Botões ligados entre o GPIO e o GND (INPUT_PULLUP).
#define BOTAO_ENTRADA_PIN 19   // amarelo: entrada de lote no silo
#define BOTAO_SAIDA_PIN   21   // vermelho: saída de lote do silo

#define FILA_TAMANHO 10

// Tipos de evento.
#define EVENTO_ENTRADA 1
#define EVENTO_SAIDA   2

// Item trafegado na fila: o horário é marcado no aperto, não na publicação,
// para eventos que esperaram o broker na fila manterem o ts correto.
struct EventoSilo {
    int tipo;
    time_t ts;
};

struct Botao {
    const char* nome;
    uint8_t pino;
    int evento;
    SemaphoreHandle_t sem;
};

// Fila única que recebe os eventos de todos os botões; criada no setup().
extern QueueHandle_t xFilaBotao;

// Marcado no fim do setup(); eventos antes de IGNORAR_INICIO_MS a partir daqui são descartados.
extern volatile TickType_t tickInicio;

void IRAM_ATTR isrBotao(void *arg);

// Uma instância por botão; recebe o Botao* como parâmetro.
void TaskBotao(void *pvParameters);
