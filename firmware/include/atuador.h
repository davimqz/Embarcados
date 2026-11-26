#pragma once

#include <Arduino.h>
#include <time.h>
#include "freertos/FreeRTOS.h"
#include "freertos/queue.h"

#define LED_VENTILACAO_PIN 23  // canal azul ou verde do LED RGB, com 100 Ω (docs/arquitetura.md §2)

#define FILA_COMANDO_TAMANHO 4
#define FILA_VENTILACAO_TAMANHO 4

// Comando já validado, recebido em grupo3/cmd.
struct ComandoVentilacao {
    uint32_t cmdSeq;  // seq do comando, gerado pelo backend
    bool ligar;
};

// Estado do LED de ventilação, publicado em grupo3/ventilacao.
struct EstadoVentilacao {
    uint32_t seq;     // número da publicação desde o boot
    time_t ts;        // momento em que o LED mudou
    bool ligada;
    bool temCmd;      // false na publicação do boot (cmd_seq vai como null)
    uint32_t cmdSeq;
};

// TaskComunicacao → TaskAtuador: comandos validados.
extern QueueHandle_t xFilaComando;
// TaskAtuador → TaskComunicacao: estado do LED a publicar.
extern QueueHandle_t xFilaVentilacao;

// Configura o LED de ventilação, desligado; chamado no setup().
void atuadorIniciar();

// Callback do MQTT para grupo3/cmd; roda dentro da TaskComunicacao (no mqttLoop()).
// Valida o payload e põe o comando na xFilaComando; descarta o inválido com log.
void atuadorReceberComando(char* topico, uint8_t* payload, unsigned int tamanho);

// Liga/desliga o LED a cada comando da xFilaComando e confirma na xFilaVentilacao.
void TaskAtuador(void *pvParameters);
