# MMIO 与 volatile

从 STM32H743 的 DBGMCU 寄存器入手，读懂地址、结构体布局和编译器生成的访存指令。原始案例来自《2026_11_4讨论_bss.html》。

## DBGMCU 寄存器访问语法

```c
#define DBGMCU_BASE  (0x5C001000UL)
#define DBGMCU       ((DBGMCU_TypeDef *) DBGMCU_BASE)

g_dbg_idcode = DBGMCU->IDCODE;
```

| 语法 | 作用 | 理解方式 |
| --- | --- | --- |
| `#define` | 预处理宏定义 | 在预处理阶段做标记替换，本身不创建变量。 |
| `0x` | 十六进制前缀 | `0x5C001000` 是一个整数形式的地址值。 |
| `UL` | 无符号 long 整数后缀 | 在常见 32 位 ARM GCC 工具链中为 32 位 unsigned long。 |
| `DBGMCU_TypeDef *` | 结构体指针类型 | 指向具有 DBGMCU 寄存器布局的对象。 |
| `(DBGMCU_TypeDef *)` | 强制类型转换 | 让编译器按结构体布局解释给定地址。 |
| `->` | 通过指针访问成员 | `p->IDCODE` 等价于 `(*p).IDCODE`。 |

宏展开以后：

```c
g_dbg_idcode = ((DBGMCU_TypeDef *)0x5C001000UL)->IDCODE;
```

对于 STM32H743，此处的 `IDCODE` 位于 DBGMCU 寄存器块起始偏移 `0x00`，因此读取的是相应的内存映射外设寄存器，而不是普通 RAM 变量。

:::tip 要点
注意：**宏定义和指针类型转换本身不产生寄存器读取**。执行成员读取表达式（如 `DBGMCU->IDCODE`）时，才发生访问。具体寄存器布局以对应芯片的 CMSIS 头文件、参考手册为准。
:::

### 结构体为何能够对应寄存器地址？

```c
/* 教学示意：不是 H743 的完整 DBGMCU_TypeDef */
typedef struct {
    volatile uint32_t IDCODE;  // 偏移 0x00
    volatile uint32_t CR;      // 偏移 0x04，仅作布局示例
} ExampleDBG_TypeDef;
```

结构体成员按定义产生偏移；外设映射地址提供结构体起点；C 语言的成员访问语法把两者结合起来。这就是 CMSIS 寄存器级编程常见的实现方式。

## 寄存器位域与汇编读改写 {#register-fields}

寄存器窗口中缩进的 WT、WB、RA 等，通常是同一个寄存器内部的**位域（bit field）**，不是又分配了独立硬件地址的“小寄存器”。

### 调试器位域标记 `[31:1]`

在原记录的调试器视图中，冒号后的数字表示**位宽**，因此 `[31:1]` 表示从 bit 31 开始的 1 位字段；`[13:15]` 表示从 bit 13 开始、长度 15 位。它不是通常文档写法的 `[31:1]`（bit31 到 bit1）。

| 界面字段 | 硬件含义 |
| --- | --- |
| `CCSIDR` | Cache Size ID Register：描述某一层级 Cache 的结构与能力。 |
| `WT / WB` | 是否支持 Write-through / Write-back 缓存策略。 |
| `RA / WA` | 是否支持 Read-allocate / Write-allocate 策略。 |
| `NS / A / LS` | Cache 的组数、相联度与缓存行大小的编码字段，通常要按架构定义换算，不是直接把原值当字节数。 |

:::tip 要点
**不要混淆地址与值：**`0xE000ED80` 是 Cortex-M7 的 CCSIDR 寄存器地址；调试器如果在地址栏显示它，不等于寄存器内容就是该数值。
:::

以后你看到 `RCC_CFGR`、`GPIOB_MODER`、`FDCAN_RXF0C`，可以按照同样思路理解：**地址 → 整个寄存器 → 字段所在位 → 编码值 → 对硬件行为的影响**。

逐条分析 `LDR`、`ADDS` 与 `STR` 的实例见 [从反汇编追踪读写地址](./Cortex-M7汇编/Thumb-2指令与寻址.md#disassembly)。

## volatile 与寄存器访问

`volatile` 让对对象的访问具有编译器必须保留的可观察语义。以 ARM GCC 为例，独立语句中的两次读取会重新访问该地址，轮询条件也会重新读设备状态。指令仍可把单次读取的结果放进通用寄存器供后续计算。

```c
volatile uint32_t status;
uint32_t x = status;  // 第一次读取
uint32_t y = status;  // 第二次读取仍需保留

while ((USART1->ISR & USART_ISR_RXNE_RXFNE) == 0U) {
    // 反复读取 USART 状态，而不是一直沿用第一次读到的旧值
}
```

### 编译器、原子性与可见性

| 需要解决的问题 | 使用的机制 |
| --- | --- |
| 保留设备状态轮询或指定的寄存器访问 | 使用芯片头文件的访问限定符，如 CMSIS 的 `__IO`，并遵循设备要求的访问宽度 |
| 避免中断、任务间的并发更新丢失 | 按场景使用原子操作、临界区或 RTOS 同步原语，核对 ISR 限制 |
| 约束处理器访存顺序或完成时点 | 根据架构和外设要求选用 DMB 或 DSB。DMB 约束顺序，DSB 还等待前序相关操作完成 |
| 让 CPU 和 DMA 看到正确数据 | 确认内存可达性及 Cache 维护或 MPU 属性，见[Cache 与 DMA 一致性](./Cache与DMA一致性.md) |

C 语言的求值和序列规则仍然适用。`volatile` 并不让 `REG++` 成为单步操作，也不让 32 位内核上的 64 位访问天然具备原子性。共享变量是否需要限定与同步取决于访问者和协议，单看变量位于 DTCM 或 SRAM 得不出结论。MMIO 还应核对只读、写一清零、读清零等位语义。对写一清零寄存器，应按手册写入掩码，避免随意套用读改写。

## 参考资料

[GCC 的 volatile 访问规则](https://gcc.gnu.org/onlinedocs/gcc/Volatiles.html) · [STM32H743 参考手册 RM0433](https://www.st.com/resource/en/reference_manual/rm0433-stm32h742-stm32h743-753-and-stm32h750-value-line-advanced-armbased-32bit-mcus-stmicroelectronics.pdf)

[STM32H743 存储映射](./STM32H743存储映射.md) · [Cache 与 DMA 一致性](./Cache与DMA一致性.md)
