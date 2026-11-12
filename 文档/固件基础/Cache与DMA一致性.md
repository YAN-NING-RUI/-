# Cache 与 DMA 一致性

适用于 STM32H743 的 Cortex-M7。先确认 DMA 能访问缓冲区，再确认 CPU 和 DMA 看到的是同一份数据。物理地址与通路见 [STM32H743 存储映射](./STM32H743存储映射.md)。

## CPU 的实际读取路径

STM32H743 具有 **16 KiB I-Cache 和 16 KiB D-Cache**，缓存行长度为 **32 字节**。I-Cache 服务于取指，D-Cache 服务于数据访问。普通 `LDR`、`STR` 的目标地址和内存属性决定是否经过 D-Cache。

| 读取对象 | 典型路径 |
| --- | --- |
| DTCM 中的数据 | CPU → DTCM 专用接口 → DTCM RAM |
| 可缓存 SRAM，命中 | CPU → D-Cache → 返回缓存中的数据 |
| 可缓存 SRAM，未命中 | CPU → D-Cache → 总线 → SRAM，通常按行填充 |
| 不可缓存 SRAM | CPU → 总线 → SRAM |

多块普通 SRAM 共享同一套 D-Cache。即使对变量使用 [volatile](./MMIO与volatile.md#volatile-与寄存器访问)，由编译器保留的读取也可能命中 D-Cache。

### 同一条访存指令，不同的目标区域

```c
/* 以下 section 需由 .ld 映射到正确存储区域 */
__attribute__((section(".dtcmram"))) volatile uint32_t data_tcm;
__attribute__((section(".axisram"))) volatile uint32_t data_axi;

void demo(void)
{
    data_tcm = 100;
    data_axi = 200;
    uint32_t a = data_tcm;  // DTCM 接口
    uint32_t b = data_tcm;  // 仍走 DTCM 接口
    uint32_t c = data_axi;  // 可能 D-Cache Hit 或 Miss
    uint32_t d = data_axi;  // 可能 D-Cache Hit 或 Miss
    (void)a; (void)b; (void)c; (void)d;
}
```

变量放置见 [链接脚本与启动初始化](./链接脚本与启动初始化.md)。这个例子用于比较通路，前面的写入可能已把 AXI SRAM 对应的行装入 Cache，因此第一次读取未必是冷缓存访问。

## DMA 缓冲区的所有权交接

Write-Back 区域的 CPU 写入可能只修改缓存中的脏行。**Clean** 把脏行写回内存。**Invalidate** 丢弃缓存副本，下次读取再从内存取数。丢弃脏行可能丢失尚未写回的数据。

| 传输方向 | CPU 交给 DMA 前 | DMA 完成后 |
| --- | --- | --- |
| TX，内存 → 外设 | CPU 填完数据，Clean 涉及的缓存行，按驱动与 CMSIS 约定确保维护完成后再启动 DMA | 确认传输完成后再改写或复用缓冲区 |
| RX，外设 → 内存 | 接收区独占缓存行。按驱动策略处理原有缓存行，例如先 Clean + Invalidate，避免旧脏行在 DMA 写入期间回写 | 确认 DMA 已完成，Invalidate 接收区，再由 CPU 读取。此时避免用 Clean 把旧缓存写回 |

传输期间应明确缓冲区由谁访问。为防止维护操作影响旁边对象，缓冲区起始地址和**实际占用范围**都按 32 字节缓存行隔离。DMA 传输长度按协议给定，维护范围覆盖对应的完整缓存行。用 CMSIS 的 by-Addr 接口时，核对项目版本的参数、对齐和屏障行为。

另一种方案是用 MPU 将专用缓冲区设为不可缓存的正常内存。这样可减少针对该区域的 Cache 维护，仍需确认 DMA 可达性、设备完成事件和访问顺序。

## 在板上确认效果

1. 从 `.map` 或调试器确认缓冲区起始地址与实际占用范围。
2. 对照总线图确认目标 DMA 可达，检查 MPU 属性与 D-Cache 启用状态。
3. 用已知数据模式分别验证 TX 和 RX，多测几轮并检查相邻缓冲区。
4. 需要评估时延时，用 DWT CYCCNT 比较冷、热缓存和总线负载条件，同时检查生成的指令。

## 参考资料

[ST AN4839 · Cortex-M7 L1 Cache 与数据一致性](https://www.st.com/resource/en/application_note/dm00272913-level-1-cache-on-stm32f7-series-and-stm32h7-series-stmicroelectronics.pdf) · [RM0433 · STM32H743 参考手册](https://www.st.com/resource/en/reference_manual/rm0433-stm32h743-753-and-stm32h750-value-line-advanced-arm-based-32-bit-mcus-stmicroelectronics.pdf)
