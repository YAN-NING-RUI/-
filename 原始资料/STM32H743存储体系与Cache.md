# STM32H743 存储体系与 Cache

> 适用：STM32H743VIT6、Cortex-M7、STM32CubeIDE / GCC。建议放置于仓库 `文档/固件基础/STM32H743存储体系与Cache.md`。

## 1. Cache 是真实硬件

STM32H743 的 Cortex-M7 内核包含 **16 KB I-Cache** 和 **16 KB D-Cache**。两者由真实的 SRAM 存储电路及标签、替换和控制逻辑组成，并非软件模拟。Cache 属于 CPU 内核的一部分，不是 SPI、USART 一类独立外设，也没有供程序通过指针直接分配变量的独立地址空间。

软件能够启用/禁用和维护 Cache，但命中判断、填充与替换等由硬件完成。`volatile` 约束编译器访问优化，不会绕过 D-Cache，也不能替代 DMA 缓存一致性维护。

## 2. H743 片内 SRAM 分布

| 存储区域 | 容量 | 起始地址 | D-Cache 关系 |
|---|---:|---|---|
| ITCM RAM | 64 KB | `0x00000000` | 专用 TCM 通路，不走 D-Cache |
| DTCM RAM | 128 KB | `0x20000000` | 专用 TCM 通路，不走 D-Cache |
| AXI SRAM | 512 KB | `0x24000000` | 可以缓存 |
| SRAM1（D2） | 128 KB | `0x30000000` | 可以缓存 |
| SRAM2（D2） | 128 KB | `0x30020000` | 可以缓存 |
| SRAM3（D2） | 32 KB | `0x30040000` | 可以缓存 |
| SRAM4（D3） | 64 KB | `0x38000000` | 可以缓存 |
| Backup SRAM | 4 KB | `0x38800000` | 可缓存，掉电保持数据应谨慎配置 |

**“可以缓存”不代表 SRAM 自带 Cache**：上述普通 SRAM 共享 CPU 的一套 16 KB D-Cache，能否缓存由内核配置和 MPU/默认内存属性决定。

## 3. 三种读取路径

```text
① 读取 DTCM：CPU → DTCM 专用接口 → DTCM RAM
② 读取 AXI SRAM，Cache Hit：CPU → D-Cache → 返回数据
③ 读取 AXI SRAM，Cache Miss：CPU → D-Cache → AXI 总线 → AXI SRAM
④ 读取不可缓存的 SRAM：CPU → 总线 → SRAM
```

CPU 使用的仍是普通 `LDR` / `STR` 等访存指令，不存在一个必须由程序显式调用的“读 Cache 指令”。D-Cache 行（Cache Line）为 **32 字节**；Miss 时可能装入整行。TCM 的优势是访问延迟可预测，Cache 的优势是提高重复访问的平均性能。

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

上述示例不能用于证明第一次 `data_axi` 读取一定 Miss，因为前面的写入也可能已使缓存行存在。

## 4. Cache、Write-Back 和 DMA

- **Cache Hit**：目标数据在缓存中，通常不再访问后级 RAM。
- **Cache Miss**：需要从后级内存取数并填充缓存。
- **Write-Back**：CPU 写入可能先更新 D-Cache 的脏行，RAM 暂时仍保存旧值。
- **Clean**：把脏行写回内存。
- **Invalidate**：使缓存行失效；错误地丢弃脏行可能造成数据丢失。

| DMA 方向 | 典型问题 | 处理思路 |
|---|---|---|
| 内存 → 外设（TX） | DMA 读取 RAM 时，CPU 最新数据尚在 Cache | 启动 DMA 前 Clean 缓冲区 |
| 外设 → 内存（RX） | DMA 已更新 RAM，但 CPU 命中旧缓存 | 按 DMA 流程处理启动前缓存状态，DMA 完成后在 CPU 读取前 Invalidate |

对于共享缓存行风险，**DMA 缓冲区起始地址及占用范围按 32 字节缓存行隔离/对齐**。具体 CMSIS by-Addr 接口的对齐和长度要求应核对项目所用版本。另一方案是在 MPU 中将专用 DMA 区域配置为不可缓存。

普通 DMA1/DMA2 **不能直接访问 DTCM**；MDMA 有相应访问路径。FDCAN Message RAM 是专用消息存储区，不能等同于普通 SRAM1/2/3。

## 5. SDRAM 与 FMC

SDRAM 是需要周期刷新、通过同步时钟操作的动态 RAM。FMC（Flexible Memory Controller）是 STM32 内部的**真实硬件存储器控制器**，负责将总线访问转换为外部 SDRAM/SRAM 的地址、读写命令和时序。

```text
CPU 访存 → 总线互连 → FMC（刷新、行列地址、时序）→ 外部 SDRAM
```

初始化并映射后可通过指针访问外部 SDRAM，但外部芯片是否能实际连接，必须核对 **STM32H743VIT6** 的 FMC 引脚复用与封装引出情况，不能只凭 H743 系列具有 FMC 外设推断。

## 6. 链接脚本 .ld 与 section

通常 STM32CubeIDE 在创建工程时生成 `*.ld` 链接脚本，GNU ld 在链接阶段读取它。并不是每次 GCC 编译 `.c` 都重新生成链接脚本。

`__attribute__((section(".dtcmram")))` 仅规定**输入段名称**，不会自动把变量放进 DTCM。最终运行地址由 `.ld` 的 `MEMORY` 和 `SECTIONS` 决定：

```ld
/* 仅为局部教学示例，不能替换整个链接脚本 */
MEMORY
{
    DTCMRAM (xrw) : ORIGIN = 0x20000000, LENGTH = 128K
    RAM_D1  (xrw) : ORIGIN = 0x24000000, LENGTH = 512K
}
SECTIONS
{
    .dtcmram (NOLOAD) :
    {
        . = ALIGN(4);
        *(.dtcmram*)
        . = ALIGN(4);
    } >DTCMRAM

    .axisram (NOLOAD) :
    {
        . = ALIGN(4);
        *(.axisram*)
        . = ALIGN(4);
    } >RAM_D1
}
```

`NOLOAD` 示例适合运行时赋值的缓冲区。**若自定义 RAM 段的变量需要非零初值**，还需正确配置 Flash 加载地址、启动复制逻辑，或在 `main()` 中自行初始化。常规 `.data` 一般由启动代码从 Flash 复制到 RAM，`.bss` 在启动时清零。可检查编译生成的 `.map` 验证变量真正地址。

## 7. H743 CAN 网关的内存选型

| 数据 | 首选考虑 | 注意 |
|---|---|---|
| 实时控制状态 | DTCM | 访问确定性较好，普通 DMA1/DMA2 不可直达 |
| 较大协议处理缓冲 | AXI SRAM | 容量大，可用 Cache 加速热点访问 |
| DMA 收发缓冲 | DMA 可访问的 AXI/D2 SRAM | 必须设计 Cache 维护或 MPU 不可缓存策略 |
| FDCAN FIFO、发送缓冲 | FDCAN Message RAM | 由 FDCAN 外设的专用配置管理 |
| 更大的图像帧缓存 | AXI SRAM / 具备接口条件的外部 SDRAM | 同时考虑带宽、封装、功耗和时序 |

### 工程核验顺序

1. 查 RM0433、芯片数据手册与具体封装。
2. 查 `*.ld` 的 `MEMORY` 和 `SECTIONS`，以及构建输出 `*.map`。
3. 确认 I-Cache、D-Cache、MPU 配置是否与预期一致。
4. 核对目标 DMA 的总线可达性及 32 字节缓存行维护。
5. 使用 DWT CYCCNT 测量，区分冷/热缓存、优化影响及总线争用。

## 官方资料

- [ST RM0433：STM32H743/753/H750 参考手册](https://www.st.com/resource/en/reference_manual/rm0433-stm32h743-753-and-stm32h750-value-line-advanced-arm-based-32-bit-mcus-stmicroelectronics.pdf)
- [ST AN4839：Level 1 Cache on STM32F7 and STM32H7 Series](https://www.st.com/resource/en/application_note/an4839-level-1-cache-on-stm32f7-series-and-stm32h7-series-stmicroelectronics.pdf)
- [ST STM32H743/753 产品资料入口](https://www.st.com/en/microcontrollers-microprocessors/stm32h743-753.html)
- [GNU ld 链接脚本文档](https://sourceware.org/binutils/docs/ld/Scripts.html)

**工程置信度：高**（存储器结构与缓存原理）；具体 DMA 通路、FMC 引脚及实测时延需针对板级工程核验。
