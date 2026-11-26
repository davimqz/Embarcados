// Teste de bancada: confere se os dois LEDs RGB estão ligados certo.
// Sequência em cada LED: vermelho, verde, azul, amarelo, ciano, magenta, branco, apagado.
// Depois os dois juntos. Cada passo é anunciado no monitor serial (9600).
#include <Arduino.h>

// Mude para true se o LED for ANODO comum (perna comprida no 3V3).
// Sintoma de valor errado: a cor "apagado" acende tudo e as cores saem trocadas.
#define ANODO_COMUM false

// LED 1
#define LED1_R 15
#define LED1_G 2
#define LED1_B 4

// LED 2 — o GPIO35 é SÓ ENTRADA no ESP32 (34 a 39 não têm saída),
// então o R do LED 2 não acende nele. Mova o fio do R para o GPIO26.
#define LED2_R 26
#define LED2_G 32
#define LED2_B 33

struct Cor { const char *nome; bool r, g, b; };

static const Cor CORES[] = {
  {"vermelho", 1, 0, 0}, {"verde", 0, 1, 0},   {"azul", 0, 0, 1},
  {"amarelo", 1, 1, 0},  {"ciano", 0, 1, 1},   {"magenta", 1, 0, 1},
  {"branco", 1, 1, 1},   {"apagado", 0, 0, 0},
};

static void escreverPino(uint8_t pino, bool aceso) {
  digitalWrite(pino, (aceso != ANODO_COMUM) ? HIGH : LOW);
}

static void aplicarCor(uint8_t r, uint8_t g, uint8_t b, const Cor &c) {
  escreverPino(r, c.r);
  escreverPino(g, c.g);
  escreverPino(b, c.b);
}

static void TaskTesteRgb(void *) {
  for (;;) {
    for (const Cor &c : CORES) {
      Serial.printf("[LED1] %s\n", c.nome);
      aplicarCor(LED1_R, LED1_G, LED1_B, c);
      vTaskDelay(pdMS_TO_TICKS(1000));
    }
    for (const Cor &c : CORES) {
      Serial.printf("[LED2] %s\n", c.nome);
      aplicarCor(LED2_R, LED2_G, LED2_B, c);
      vTaskDelay(pdMS_TO_TICKS(1000));
    }
    for (const Cor &c : CORES) {
      Serial.printf("[LED1+LED2] %s\n", c.nome);
      aplicarCor(LED1_R, LED1_G, LED1_B, c);
      aplicarCor(LED2_R, LED2_G, LED2_B, c);
      vTaskDelay(pdMS_TO_TICKS(1000));
    }
  }
}

void setup() {
  Serial.begin(9600);
  const uint8_t pinos[] = {LED1_R, LED1_G, LED1_B, LED2_R, LED2_G, LED2_B};
  for (uint8_t p : pinos) {
    pinMode(p, OUTPUT);
    escreverPino(p, false);
  }
  Serial.println("Teste RGB iniciado");

  if (xTaskCreate(TaskTesteRgb, "TesteRgb", 2048, nullptr, 1, nullptr) != pdPASS) {
    Serial.println("ERRO: nao foi possivel criar a TaskTesteRgb");
  }
}

void loop() {
  vTaskDelete(nullptr);  // tudo roda na TaskTesteRgb
}
