# CMSIS-RTOS2 线程创建与参数

从 CubeMX 的任务入口出发，区分创建属性、传入参数和创建成功后返回的句柄。

## 入口、创建属性与线程句柄 {#thread-types}

| 类型 | 用途 |
| --- | --- |
| `osThreadFunc_t` | 入口函数的指针类型，签名为 `void (*)(void *)` |
| `osThreadAttr_t` | 创建前配置名称、优先级和栈大小等属性，`stack_size` 的单位为字节 |
| `osThreadId_t` | 创建后返回的线程标识符，底层表示由适配层决定 |

若工程中出现 `osThread_t`，先跳转到类型定义，核对它在该工程或移植层的含义。下面的例子在内核已初始化后调用 `CreateCanTask()`，调用方需检查返回值。

```c
#include "cmsis_os2.h"
#include <stddef.h>

static void StartCanTask(void *argument)
{
    (void)argument;
    for (;;) {
        osDelay(10U);  // 10 个内核节拍
    }
}

static const osThreadAttr_t canAttr = {
    .name = "CanTask",
    .stack_size = 1024U,
    .priority = osPriorityNormal
};

osThreadId_t CreateCanTask(void)
{
    return osThreadNew(StartCanTask, NULL, &canAttr);
}
```

`osThreadNew()` 的三个参数依次是入口函数、传给入口的参数、线程属性。失败时返回 `NULL`。若创建失败或任务一直没有运行，参见 [FreeRTOS 任务与内存排查](./FreeRTOS任务与内存排查.md)。

## 线程参数与局部数组 {#thread-argument}

`argument` 来自 `osThreadNew()`。入口内部声明的 `uint8_t startupData[8]` 是独立的局部数组，若分配存储，通常占用当前任务的栈。入口可以先写 `(void)argument;`，再声明和使用数组。语法见 [C 语言对象指针与函数指针](../固件基础/C语言对象指针与函数指针.md#void-expressions)。

创建接口会传递指针值。若线程需要长期访问指向的数据，应保证对象在使用期间有效，例如传入静态配置结构体，或明确分配内存的所有权。创建函数的局部数组随函数返回结束生命周期，即使线程稍后才运行也不能继续访问。

## 参考资料

[Arm CMSIS-RTOS2 · Thread Management](https://arm-software.github.io/CMSIS_6/main/RTOS2/group__CMSIS__RTOS__ThreadMgmt.html)
