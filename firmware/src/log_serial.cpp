#include <Arduino.h>
#include <stdarg.h>

#include "log_serial.h"

SemaphoreHandle_t xMutexSerial = NULL;

void logSerial(const char* fmt, ...) {
    char buf[160];
    va_list args;
    va_start(args, fmt);
    vsnprintf(buf, sizeof(buf), fmt, args);
    va_end(args);

    if (xMutexSerial != NULL) {
        xSemaphoreTake(xMutexSerial, portMAX_DELAY);
    }
    Serial.print(buf);
    if (xMutexSerial != NULL) {
        xSemaphoreGive(xMutexSerial);
    }
}
