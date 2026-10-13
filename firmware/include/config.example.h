// Modelo de configuração do firmware.
// Copie para config.h (ignorado pelo git) e preencha com os valores reais:
//   cp include/config.example.h include/config.h
// Nunca commite o config.h.
#pragma once

#include <stdint.h>

// --- Wi-Fi ---
#define WIFI_SSID       "SEU_SSID"
#define WIFI_PASSWORD   "SUA_SENHA"

// --- Broker MQTT ---
#define MQTT_BROKER     "192.168.0.10"
#define MQTT_PORT       1883

// --- Identificação ---
#define NUMERO_GRUPO    "3"
