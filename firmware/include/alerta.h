#pragma once

#include <Arduino.h>
#include <time.h>
#include "freertos/FreeRTOS.h"
#include "freertos/queue.h"

#include "sensores.h"

#define LED_ALERTA_PIN 22  // canal vermelho do LED RGB, com 220 Ω (docs/arquitetura.md §2)

// Limiar com histerese: decisão 5 de docs/decisoes-pendentes.md.
#define ALERTA_TEMP_LIGA    30  // °C: acima disso, ATIVO
#define ALERTA_UMID_LIGA    70  // %
#define ALERTA_TEMP_DESLIGA 28  // °C: abaixo disso (e da umidade), volta a NORMAL
#define ALERTA_UMID_DESLIGA 65  // %

#define FILA_ALERTA_TAMANHO 4

// Mudança de estado do alerta, publicada em grupo3/alerta.
struct AlertaSilo {
    uint32_t seq;        // número da mudança de estado desde o boot
    time_t ts;           // ts da leitura que mudou o estado
    bool ativo;
    bool motivoTemperatura;
    bool motivoUmidade;
    int temperatura;
    int umidade;
};

// Fila de mudanças de estado da TaskSensores para a TaskComunicacao; criada no setup().
extern QueueHandle_t xFilaAlerta;

// Configura o LED de alerta, apagado; chamado no setup().
void alertaIniciar();

// Chamado pela TaskSensores a cada leitura. Aplica o limiar, acende ou apaga o LED na hora
// (mesmo sem rede) e põe na xFilaAlerta a primeira leitura válida e cada mudança de estado.
void alertaAvaliar(const LeituraSilo *leitura);
