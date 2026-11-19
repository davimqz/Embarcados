// Teste de montagem: HC-SR04, DHT11 e dois botões.
// Imprime no serial a cada 1 s a distância e temperatura/umidade,
// e na hora em que cada botão é apertado/solto.
#include <Arduino.h>
#include <DHT.h>

#define PINO_TRIG      5
#define PINO_ECHO      14
#define PINO_DHT       25
#define PINO_VERMELHO  21   // botão para o GND (usa pull-up interno)
#define PINO_AMARELO   19

DHT dht(PINO_DHT, DHT11);

int estadoVermelho = HIGH;
int estadoAmarelo  = HIGH;
unsigned long ultimaLeitura = 0;

float lerDistanciaCm() {
  digitalWrite(PINO_TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(PINO_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(PINO_TRIG, LOW);
  unsigned long us = pulseIn(PINO_ECHO, HIGH, 30000);  // timeout ~5 m
  if (us == 0) return -1;
  return us / 58.0f;
}

void checarBotao(int pino, int &estadoAnterior, const char *nome) {
  int agora = digitalRead(pino);
  if (agora != estadoAnterior) {
    delay(20);  // debounce simples
    agora = digitalRead(pino);
    if (agora != estadoAnterior) {
      estadoAnterior = agora;
      Serial.printf("[BOTAO] %s %s\n", nome, agora == LOW ? "APERTADO" : "solto");
    }
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(PINO_TRIG, OUTPUT);
  pinMode(PINO_ECHO, INPUT);
  pinMode(PINO_VERMELHO, INPUT_PULLUP);
  pinMode(PINO_AMARELO, INPUT_PULLUP);

  // Diagnóstico do DHT: sem pull-up interno, a linha DATA em repouso tem que estar HIGH.
  pinMode(PINO_DHT, INPUT);
  delay(500);
  Serial.printf("\n[DHT11] linha DATA em repouso (sem pull-up interno): %s\n",
                digitalRead(PINO_DHT) ? "HIGH (ok)" : "LOW -> sem pull-up, sem VCC, em curto ou fio no pino errado");

  dht.begin();
  delay(1000);
  Serial.println("\n=== Teste de montagem ===");
  Serial.printf("Botões em repouso: vermelho=%s amarelo=%s (esperado: HIGH/HIGH)\n",
                digitalRead(PINO_VERMELHO) ? "HIGH" : "LOW",
                digitalRead(PINO_AMARELO) ? "HIGH" : "LOW");
}

void loop() {
  checarBotao(PINO_VERMELHO, estadoVermelho, "VERMELHO (D21)");
  checarBotao(PINO_AMARELO, estadoAmarelo, "AMARELO (D19)");

  if (millis() - ultimaLeitura >= 2000) {  // DHT11 aceita no máx. 1 leitura por segundo
    ultimaLeitura = millis();

    float d = lerDistanciaCm();
    if (d < 0) Serial.print("[HCSR04] sem eco (confira VCC 5V, TRIG D5, ECHO D14)");
    else       Serial.printf("[HCSR04] %.1f cm", d);

    float t = dht.readTemperature();
    float h = dht.readHumidity();
    if (isnan(t) || isnan(h)) Serial.println("  |  [DHT11] falha na leitura (confira D25, 3V3, GND, pull-up)");
    else                      Serial.printf("  |  [DHT11] %.1f C  %.1f %%\n", t, h);
  }
}
