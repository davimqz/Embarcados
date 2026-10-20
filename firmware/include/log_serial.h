#pragma once

#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"

// Criado no setup() antes de qualquer task.
extern SemaphoreHandle_t xMutexSerial;

// Serial compartilhado entre tasks dos dois núcleos: monta a mensagem inteira
// num buffer local e só então escreve, segurando o mutex, para as linhas não se misturarem.
void logSerial(const char* fmt, ...);
