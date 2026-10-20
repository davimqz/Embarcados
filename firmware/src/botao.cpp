#include "botao.h"
#include "log_serial.h"

#define DEBOUNCE_MS 200
#define CONFIRMA_MS 50          // o pino precisa ficar em LOW esse tempo todo para contar
#define IGNORAR_INICIO_MS 2000  // o D19 vai a LOW sozinho logo após o boot; ignora esse período

QueueHandle_t xFilaBotao = NULL;
volatile TickType_t tickInicio = 0;

// Sem trava de tempo aqui: um pulso de ruído não pode bloquear o aperto real que vem logo depois.
// Quem filtra é a TaskBotao (confirmarAperto + espera de DEBOUNCE_MS após soltar).
void IRAM_ATTR isrBotao(void *arg) {
    Botao *b = (Botao *)arg;
    BaseType_t tarefaDespertada = pdFALSE;
    xSemaphoreGiveFromISR(b->sem, &tarefaDespertada);

    if (tarefaDespertada == pdTRUE) {
        portYIELD_FROM_ISR();
    }
}

// Amostra o pino a cada 5 ms; um único HIGH na janela descarta o evento (toque acidental ou ruído).
static bool confirmarAperto(uint8_t pino) {
    for (int i = 0; i < CONFIRMA_MS / 5; i++) {
        if (digitalRead(pino) != LOW) {
            return false;
        }
        vTaskDelay(pdMS_TO_TICKS(5));
    }
    return true;
}

void TaskBotao(void *pvParameters) {
    Botao *b = (Botao *)pvParameters;

    for (;;) {
        if (xSemaphoreTake(b->sem, portMAX_DELAY) == pdTRUE) {
            if ((TickType_t)(xTaskGetTickCount() - tickInicio) < pdMS_TO_TICKS(IGNORAR_INICIO_MS)) {
                continue;
            }

            // Ruído é descartado em silêncio.
            if (!confirmarAperto(b->pino)) {
                continue;
            }

            EventoSilo ev = {b->evento, time(nullptr)};

            if (xQueueSend(xFilaBotao, &ev, pdMS_TO_TICKS(10)) == pdPASS) {
                logSerial("[BOTAO] %s pressionado: evento enviado para a fila.\n", b->nome);
            } else {
                logSerial("[ERRO] Fila cheia. Evento descartado.\n");
            }

            while (digitalRead(b->pino) == LOW) {
                vTaskDelay(pdMS_TO_TICKS(10));
            }

            vTaskDelay(pdMS_TO_TICKS(DEBOUNCE_MS));
            xSemaphoreTake(b->sem, 0);
        }
    }
}
