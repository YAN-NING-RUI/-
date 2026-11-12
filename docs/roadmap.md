# 知识版图

## 固件基础

- [STM32H743 寄存器访问与内存布局](./firmware/stm32h743-registers-memory.md)

  从 `DBGMCU->IDCODE` 看内存映射访问，再追踪 `volatile`、链接脚本和启动初始化。

## 外设通信

- [STM32H743 FDCAN 工程手册](./peripherals/stm32h743-fdcan-handbook.md)

  从 CubeIDE 配置走到 CAN 网关验证，涵盖时钟、位时序、Message RAM、过滤器和中断。

## 实时操作系统

- [FreeRTOS 与 I²C 调试笔记](./rtos/freertos-i2c-debugging.md)

  比较轮询、中断和 DMA，记录 STM32F103 RAM 预算与任务、传感器排查顺序。

## 硬件设计

- [隔离采样电路笔记](./hardware/isolated-sampling.md)

  记录隔离供电、输入 RC 滤波、Shutdown 控制和差分输出。
