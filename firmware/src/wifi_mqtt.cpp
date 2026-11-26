#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <time.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

#include "config.h"
#include "log_serial.h"
#include "wifi_mqtt.h"

// O SDK do ESP32 tem outros "config.h" no include path; checa por um define nosso.
#ifndef WIFI_SSID
#error "config.h nao encontrado: copie include/config.example.h para include/config.h e preencha"
#endif

// Contrato em docs/topicos-mqtt.md.
static const char* MQTT_TOPIC_STATUS = "grupo" NUMERO_GRUPO "/status";

#define RECONEXAO_MS 5000      // intervalo entre tentativas de reconectar Wi-Fi e MQTT
#define MQTT_KEEPALIVE_S 15    // o broker publica o LWT ~1,5x isso depois de a placa sumir

static WiFiClient wifiClient;
static PubSubClient mqtt(wifiClient);

static char idDispositivo[32];
static const char* topicoAssinado = NULL;

void wifiMqttIniciar() {
    mqtt.setServer(MQTT_BROKER, MQTT_PORT);
    mqtt.setSocketTimeout(3);
    mqtt.setKeepAlive(MQTT_KEEPALIVE_S);

    snprintf(idDispositivo, sizeof(idDispositivo), "esp32-grupo%s-%llx", NUMERO_GRUPO,
             (unsigned long long)ESP.getEfuseMac());

    logSerial("[WiFi] Conectando a %s...\n", WIFI_SSID);
    WiFi.mode(WIFI_STA);
    WiFi.setAutoReconnect(true);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    // Horário em UTC; o SNTP sincroniza sozinho assim que o Wi-Fi conectar.
    configTime(0, 0, "pool.ntp.org", "a.st1.ntp.br");
}

void verificarWiFi() {
    static bool conectado = false;
    static TickType_t ultimaTentativa = 0;
    static int tentativas = 0;

    if (WiFi.status() == WL_CONNECTED) {
        if (!conectado) {
            conectado = true;
            tentativas = 0;
            logSerial("[WiFi] Conectado. IP local: %s\n", WiFi.localIP().toString().c_str());
        }
        return;
    }

    if (conectado) {
        conectado = false;
        logSerial("[WiFi] Conexao perdida.\n");
    }

    if ((TickType_t)(xTaskGetTickCount() - ultimaTentativa) < pdMS_TO_TICKS(RECONEXAO_MS)) {
        return;
    }
    ultimaTentativa = xTaskGetTickCount();

    // O auto-reconnect do ESP32 costuma resolver sozinho; a cada 30 s força uma nova tentativa.
    // Status: 1 = rede nao encontrada, 4 = falha (senha), 6 = desconectado.
    logSerial("[WiFi] Sem conexao, status = %d\n", WiFi.status());
    if (++tentativas % 6 == 0) {
        WiFi.reconnect();
    }
}

void verificarMQTT() {
    static TickType_t ultimaTentativa = 0;
    static bool primeiraTentativa = true;

    if (mqtt.connected() || WiFi.status() != WL_CONNECTED) {
        return;
    }

    if (!primeiraTentativa &&
        (TickType_t)(xTaskGetTickCount() - ultimaTentativa) < pdMS_TO_TICKS(RECONEXAO_MS)) {
        return;
    }
    primeiraTentativa = false;
    ultimaTentativa = xTaskGetTickCount();

    char statusOnline[80];
    char statusOffline[80];
    snprintf(statusOnline, sizeof(statusOnline), "{\"device_id\":\"%s\",\"status\":\"online\"}", idDispositivo);
    snprintf(statusOffline, sizeof(statusOffline), "{\"device_id\":\"%s\",\"status\":\"offline\"}", idDispositivo);

    logSerial("[MQTT] Conectando ao broker: %s\n", MQTT_BROKER);

    // LWT: se a conexão cair sem aviso, o próprio broker publica o "offline" (retido).
    if (mqtt.connect(idDispositivo, MQTT_TOPIC_STATUS, 1, true, statusOffline)) {
        logSerial("[MQTT] Conectado ao broker.\n");
        mqtt.publish(MQTT_TOPIC_STATUS, statusOnline, true);
        if (topicoAssinado != NULL) {
            if (mqtt.subscribe(topicoAssinado, 1)) {
                logSerial("[MQTT] Assinado: %s\n", topicoAssinado);
            } else {
                logSerial("[MQTT] Falha ao assinar %s\n", topicoAssinado);
            }
        }
    } else {
        logSerial("[MQTT] Falha na conexao. Estado: %d (nova tentativa em %d s)\n",
                  mqtt.state(), RECONEXAO_MS / 1000);
    }
}

void mqttAssinar(const char* topico, void (*callback)(char*, uint8_t*, unsigned int)) {
    topicoAssinado = topico;
    mqtt.setCallback(callback);
}

bool mqttConectado() {
    return mqtt.connected();
}

void mqttLoop() {
    mqtt.loop();
}

bool mqttPublicar(const char* topico, const char* payload, bool retido) {
    return mqtt.publish(topico, payload, retido);
}

const char* deviceId() {
    return idDispositivo;
}
