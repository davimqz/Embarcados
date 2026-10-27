#pragma once

// Conexão Wi-Fi + MQTT. Tudo aqui é chamado só pela TaskComunicacao.

// Monta o device_id, configura o cliente MQTT, inicia o Wi-Fi e o NTP.
void wifiMqttIniciar();

// Uma tentativa por chamada, sem laço: a TaskComunicacao não pode ficar presa aqui,
// senão a fila enche e os eventos seguintes são descartados.
void verificarWiFi();
void verificarMQTT();

bool mqttConectado();
void mqttLoop();
// retido: o broker guarda a última mensagem e a entrega a quem assinar depois.
bool mqttPublicar(const char* topico, const char* payload, bool retido = false);

// "esp32-grupo<N>-<MAC em hex>"; válido depois de wifiMqttIniciar().
const char* deviceId();
