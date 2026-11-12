<script setup>
import FdcanTiming from '../components/FdcanTiming.vue'
import FdcanFifo from '../components/FdcanFifo.vue'
import GatewayChecklist from '../components/GatewayChecklist.vue'

const checks = [
  "用截图或日志确认系统时钟、FDCAN kernel clock 和 500 kbit/s 计算一致。",
  "内部回环发送 ID 0x123，回调收到同样的 ID/DLC/数据。",
  "验证单条报文即可触发 NEW_MESSAGE；FIFO 4 槽不会要求等满再中断。",
  "中断里使用 FromISR 入队，FreeRTOS 任务成功消费数据，且优先级符合配置。",
  "统计接收数、发送数、软件队列丢帧、FIFO message lost，长时间运行。",
  "两路 FDCAN/外部 USB-CAN 测试正常模式、ACK 和双向网关转发。",
  "在 CPU 高负载下测延时/占用率，决定是否有必要提升 CPU 主频。"
]
</script>

# STM32H743 FDCAN 工程手册

把这段对话里零散的寄存器、时钟树、复用引脚、CAN 位时序、Message RAM、中断和 FreeRTOS 重新串成一条完整的工程链路。面向你的当前练手项目：**H743 + FreeRTOS 的 CAN 网关**。

> 根据 2026 年 11 月 6 日的《STM32H743 FDCAN 学习手册》整理。配置参数是来源中的示例，接入实物时请核对工程和板卡。

:::tip 要点
**信息边界：**本手册使用你此前截图显示的参数作为「当前示例」，不是对本地完整 `.ioc` 工程或真实 PCB 的自动读取。特别是 `HSE_VALUE = 25000000UL`、时钟树选项、CAN 收发器与终端电阻，都必须结合实际代码和电路确认。
:::

| 示例参数 | 数值 | 核对项 |
| --- | --- | --- |
| 图中 HSE 输入 | 25 MHz | 应确认实物板提供该时钟 |
| 图中 CPU 时钟 | 64 MHz | SYSCLK 当前选用 HSI |
| FDCAN 标称速率 | 500 kb/s | 预分频 1，每位 50 tq |
| Rx FIFO0 容量 | 4 帧 | 不是 4 Byte |

延伸阅读：[STM32H743 寄存器访问与内存布局](../firmware/stm32h743-registers-memory.md) · [FreeRTOS 与 I²C 调试笔记](../rtos/freertos-i2c-debugging.md)

## 先建立整体架构 {#overview}

你看到的 CubeMX 设置，是在给不同硬件模块填写工作规则；并不是让 CPU 用软件逐位模拟 CAN。

外部 CAN 节点（ECU / USB-CAN / 其他 MCU） → CAN 收发器（差分物理层 CANH/CANL） → H743 FDCAN（仲裁 / CRC / 位同步 / FIFO） → NVIC 中断（通知 CPU 有事件） → FreeRTOS 任务（解析 / 排队 / 转发）

#### 硬件层

时钟、GPIO 复用、FDCAN 控制器、Message RAM、外部收发器与终端电阻。

#### 驱动层

HAL 配置过滤器、启动 FDCAN、收发 API、通知回调和错误处理。

#### 任务层

FreeRTOS 任务/队列、CAN1↔CAN2 路由、统计与实时性测试。

:::tip 要点
**关键工程观念：**CPU 主频、FDCAN 内核时钟、APB 时钟是不同概念。CAN 线上每一个 bit 的传输并不由 CPU 中断手动完成，主要由独立的 FDCAN 硬件负责。
:::

### 本阶段究竟要证明什么？

1. 硬件时钟、引脚和 Message RAM 配置能够正确初始化。
2. 内部回环下能发出一帧并通过 FIFO + 中断读回。
3. 中断能安全地向 FreeRTOS 任务传递完整数据。
4. 最终两路 FDCAN 互联，在外部收发器支持下验证真实转发。

**H743 是否“性能过剩”？**只做简单的 500 kb/s CAN 转发时，64 MHz 可能已经足够。选择 H743 的价值是让网关后续扩展到多总线、任务调度、数据处理、缓存/记录和协议转换；是否需要把 CPU 提升至 400/480 MHz，应依据 CPU 占用率和时延实测决定。

## CubeIDE：配置在什么地方，代码又在哪？ {#ide}

最重要的是分清「配置模型」和「生成的 C 代码」。你截图里看到的是配置界面，程序真正运行的是初始化函数与寄存器操作。

| 你想找什么 | 通常位置 | 搜索关键词 |
| --- | --- | --- |
| 可视化时钟/外设设置 | 工程根目录 `*.ioc` | `Clock Configuration`、`FDCAN1` |
| HSE_VALUE 宏 | 常见于 `Drivers/CMSIS/.../stm32h7xx.h`，也可能由工程宏覆盖 | `HSE_VALUE` |
| 系统时钟初始化 | `Core/Src/main.c` 中 `SystemClock_Config()` 等 | `SYSCLKSource`、`HSEState` |
| FDCAN 初始化 | `Core/Src/main.c` 或独立 `fdcan.c` | `MX_FDCAN1_Init`、`hfdcan1.Init` |
| GPIO 引脚复用与 NVIC | 通常在 `stm32h7xx_hal_msp.c` | `GPIO_AF9_FDCAN1`、`HAL_NVIC_EnableIRQ` |
| FDCAN ISR 入口 | `Core/Src/stm32h7xx_it.c` | `FDCAN1_IT0_IRQHandler` |
| HAL API 的实现 | `Drivers/STM32H7xx_HAL_Driver/Src/` | `HAL_FDCAN_ActivateNotification` |
| FreeRTOS 中断上限 | `FreeRTOSConfig.h`（所在目录依工程而异） | `configLIBRARY_MAX_SYSCALL_INTERRUPT_PRIORITY` |

### 实际搜索快捷键

- Ctrl + H：打开 Eclipse 搜索窗口，选 **File Search**，范围可设当前工程。
- Ctrl + F：只搜索当前已打开文件。
- Ctrl + Shift + R：按文件名快速打开文件。
- F3 或 Ctrl + 单击：在 C 符号解析正常时跳转定义。

:::tip 要点
生成代码选项不同，初始化函数可能放在 `main.c` 或独立 `fdcan.c`；不应死记某一种文件路径。优先全工程搜索函数名。
:::

## 寄存器：展开的“小寄存器”究竟是什么？ {#registers}

寄存器窗口中缩进的 WT、WB、RA 等，通常是同一个寄存器内部的**位域（bit field）**，不是又分配了独立硬件地址的“小寄存器”。

### 先看你截图里的 `[31:1]`

在你的调试器视图中，冒号后的数字表示**位宽**，因此 `[31:1]` 表示从 bit 31 开始的 1 位字段；`[13:15]` 表示从 bit 13 开始、长度 15 位。它不是通常文档写法的 `[31:1]`（bit31 到 bit1）。

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

:::tip 要点
延伸到 H743 的 D-Cache：后续涉及 DMA、多个存储器区域（D1/D2/D3）时，需要关注 Cache 一致性和 DMA 可达性；这属于真正上线大吞吐系统时的重点，不是你现在 CAN 内部回环必须先解决的问题。
:::

## 时钟树：HSI、HSE 和 PLL 如何配合？ {#clocks}

| 来源 | 是什么 | 你应记住什么 |
| --- | --- | --- |
| `HSI` | 高速内部 RC；H743 标称 64 MHz | 不依赖外部晶振；你的时钟树截图中系统主时钟选的是它。 |
| `CSI` | 内部约 4 MHz RC 时钟 | 常用于一些低功耗/外设用途；与 HSI 是不同来源。 |
| `HSE` | 高速外部晶振或外部时钟输入 | CubeMX 的 Crystal/Ceramic Resonator 表示板上要有对应振荡电路；BYPASS 则是外部直接提供时钟信号。 |
| `LSI / LSE` | 低速内部 RC / 外部 32.768 kHz 晶振 | 常见于 RTC、独立看门狗等低速应用；LSE Disable 不妨碍一般 CPU 运算。 |
| `PLL1 / PLL2 / PLL3` | 锁相环倍频、分频、产生其他工作时钟 | 配置了 PLL 参数，不代表 SYSCLK 就已经选择 PLL。 |

### 为什么叫“锁相环（Phase-Locked Loop）”？

它利用参考时钟与反馈时钟的相位差进行反馈调节，使内部振荡频率与参考频率维持确定的比例关系。你在 CubeMX 中实际操作的是 PLL 的分频、倍频、输出选择：输入先除以 M，再经 VCO 倍频 N，最后通过 P/Q/R 输出不同频率。

```text
PLL 输入 → ÷ M → × (N + FRACN/8192) → VCO → ÷ P / ÷ Q / ÷ R
```

理想化、忽略小数分频时：`f_PLLP = f_source ÷ M × N ÷ P`。实际参数仍须满足 ST 对 PLL 输入范围、VCO 范围、电源、电压缩放与总线时钟上限的规定。

举个与你截图相符的算术例子：选择 HSI=64 MHz、M=32、N=129、P=2，PLL1P 理论输出为 **129 MHz**；但你的 `System Clock Mux` 仍选 HSI，CPU 就仍是 **64 MHz**，而不是 129 MHz。

:::tip 要点
**工程风险：**不要看到 `HSE_VALUE = 25000000UL` 就认定板上有一个正在工作的 25 MHz 晶振。这个宏是软件用于计算的频率定义。若 FDCAN 内核时钟选择 HSE，还必须保证 HSE 硬件实际存在、配置正确且已启动。
:::

另外，H743 提到的最高 480 MHz 是有运行条件的：需要检查具体器件/修订、VOS、电源配置、Flash 等待周期及总线分频。CAN 网关早期不必为了“用满 H743”而盲目把 CPU 拉到极限。

## GPIO 复用：PB8/PB9 如何连接到 CAN？ {#pins}

你之前截图显示 FDCAN1 使用 PB8 和 PB9，GPIO 设置为 `Alternate Function Push Pull`。在 H743 的常见对应关系是：

| MCU 引脚 | 复用功能 | 连接方向 |
| --- | --- | --- |
| `PB8` | `AF9 / FDCAN1_RX` | CAN 收发器 RXD → MCU PB8 |
| `PB9` | `AF9 / FDCAN1_TX` | MCU PB9 → CAN 收发器 TXD |

H743 PB9 (TX)（逻辑电平） → CAN 收发器 TXD（转换为差分驱动） → CANH / CANL（共享的物理总线）

**推挽 / 复用功能并不意味着 PB8、PB9 可以直接接 CANH/CANL。** MCU 的 TX/RX 是数字逻辑信号；CANH/CANL 是总线差分信号，需要专门 CAN 收发器。高速 CAN 常用总线两端各 120 Ω 终端，实际要按物理网络拓扑安装。

区分层次：普通高速 CAN 的隐性状态通常是两根线处于接近的共模电压；你之前看到的“容错/低速 CAN 隐性回到一高一低的偏置电平”属于不同物理层实现，不能直接套到高速 CAN 总线上。文中 `RTH` / `RTL` 代表该类容错物理层终端偏置网络相关的参考电位，需要依具体收发器手册判断，不是 H743 FDCAN 控制器里的寄存器。**同为 CAN 协议，不等于物理电平细节完全相同。**

:::tip 要点
**你实际应该核对：**CubeMX 里 Pinout 是否 PB8=RX/PB9=TX、`GPIO_AF9_FDCAN1` 是否生成、外部收发器供电及电平是否匹配、终端位置是否正确。
:::

## CAN、CAN FD 与 UDS：属于不同层次 {#can}

| 概念 | 作用 | 在你的项目里对应什么 |
| --- | --- | --- |
| 经典 CAN | 多主总线，消息 ID 仲裁；一帧最多 8 字节数据 | 你当前选择 `Frame Format = Classic mode` |
| CAN FD | 数据字段最长 64 字节，可选 BRS 数据段提速 | 只有启用 FD 帧时，Data Bit Timing 才参与数据阶段位速率 |
| ISO-TP | 把较长数据拆成若干 CAN 帧并重组 | UDS 传输长报文时通常需要这一层 |
| UDS（ISO 14229） | ECU 诊断应用层：读信息、故障码、诊断会话等 | 可由 PC 或第二块 MCU 模拟诊断仪/ECU |

### CubeIDE 的 FDCAN Mode 不是“帧格式”

| Mode | 用途 | 你现在需不需要 |
| --- | --- | --- |
| `Normal mode` | 在真实总线上正常收发、参与仲裁与应答。 | 接入外部节点后的目标模式。 |
| `Internal LoopBack` | 控制器内部自发自收，适合在没有外部 ECU 和收发器时做软件自测。 | 当前推荐。 |
| `External LoopBack` | 外部回环测试路径，与内部回环的信号路径不同；连接要求需结合参考手册和板级硬件确认。 | 后续硬件联调时再研究。 |
| `Bus Monitoring` | 只监听总线，不参与正常发送或 ACK，用于观察已有网络。 | 抓取真实总线活动时有用。 |
| `Restricted operation` | 限制正常数据发送的特殊运行状态；不是普通的网关通信模式。 | 当前不需要。 |

### 三个 CAN 必懂机制

#### 显性 0 / 隐性 1

显性可以覆盖隐性。总线控制器通过这种电平关系实现非破坏性仲裁。

#### 按消息 ID 仲裁

标准帧使用 11 位 ID，扩展帧使用 29 位 ID；在其他条件相同时，低 ID 的优势更大，不是节点拥有永久优先级。

#### ACK、错误、重发

协议硬件管理 CRC、应答和错误状态；正常总线上发送者通常需要其他正常接收节点提供 ACK。

:::tip 要点
高速 CAN 的差分电压、电气容差与低速容错 CAN 的终端偏置机制不同。不要把不同收发器数据手册里的物理电压阈值混用。
:::

### 网关、诊断仪、ECU 是三个不同角色

UDS 诊断仪（发起诊断请求） → CAN 网络 / 网关（转发正确的 CAN 帧） → ECU（或模拟 ECU）（解析服务并响应）

例如 UDS 服务 `0x10` 切换诊断会话、`0x22` 按 DID 读取数据、`0x19` 查询 DTC，都是**应用层语义**。FDCAN 硬件只知道 CAN 帧 ID、DLC 和数据，不会自动替你实现 UDS。

## CAN 位时序：Nominal、Data、采样点与 SJW {#timing}

这是你在这段对话中反复追问、也最值得弄懂的一节。先记住：**跳变沿用来校准位边界，采样点用来判读显性/隐性值。**

### 位时间组成

一个标称 CAN bit 通常分为固定 `Sync_Seg = 1 tq`、可配置 `TimeSeg1` 和 `TimeSeg2`。

标称位从同步段（1 tq）开始，经过 TimeSeg1（39 tq）到达采样点，再经过 TimeSeg2（10 tq）到达位终点。

**你的截图实例：**FDCAN 时钟 25 MHz，Nominal Prescaler = 1，TimeSeg1 = 39，TimeSeg2 = 10，因此 tq=40 ns，一位=50 tq=2000 ns，波特率 500 kbit/s，采样点为 80%。

### 位时序实时计算器

修改内核时钟、预分频和时间段，观察位速率与采样点。

- 时间量子 `tq = BRP / f_ker`。`BRP` 是预分频值，`f_ker` 是 FDCAN 内核时钟频率。用 Hz 代入时，结果单位为秒。
- 每位含 `N = 1 + TimeSeg1 + TimeSeg2` 个时间量子，其中 1 来自固定同步段。位速率为 `1 / (N × tq)`，单位为 bit/s。
- 采样点位于 TimeSeg1 末尾，占整个位时间的比例为 `(1 + TimeSeg1) / N`。

<FdcanTiming />

### 采样点：读取“0 或 1”

接收节点不在检测到跳变的瞬间立即决定当前 bit 是 0 还是 1，而是在约定的采样点对总线逻辑状态进行判读。将采样点设置在位时间内合适的位置，可为信号传播延迟和电平稳定留出时间。

但采样点越靠后并非绝对越好；还需给 TimeSeg2 留出足够的相位误差容忍空间。

### 跳变沿：用于重新同步

CAN 控制器单独检测符合规则的有效边沿，以发现本地位边界与总线实际边界的偏差，并按同步规则调节相邻时间段长度。**它不是在等采样点时才去寻找跳变。**

二者逻辑相关、目的不同：边沿帮助校正“什么时候读”，采样点决定“读到什么”。

### SJW（Synchronization Jump Width）：允许每次校正多少？

SJW 限制一次重同步时能够缩短或延长位时间相关相位段的最大幅度，单位是 tq，而不是“固定等待 SJW 后再采样”。

**直观例子：**正常预计边沿应在 t = 0 到来，实际有效边沿比预期晚 1 tq。若 SJW = 1 tq 且其他条件允许，控制器可通过调整相位段对这 1 tq 偏差进行补偿；若偏差为 3 tq、SJW 只有 1 tq，就不能指望一次调整直接消除全部 3 tq。

真实 CAN 重同步根据检测到的边沿发生在相位段的哪一侧，选择延长前段或缩短后段；并非所有边沿都会用于重同步。

:::tip 要点
**你的追问得出的正确结论：**采样点主要为了可靠判断稳定的显性/隐性状态；有效跳变沿检测用于时间同步。它们是同一个 CAN 位时序系统中的两个不同动作。
:::

### Nominal / Data 前缀的根本区别

| 参数组 | 适用阶段 | 你的当前 Classic mode |
| --- | --- | --- |
| `Nominal Prescaler / Seg1 / Seg2 / SJW` | 仲裁阶段；经典 CAN 整帧以及 CAN FD 的标称速率阶段 | 必须正确配置 |
| `Data Prescaler / Seg1 / Seg2 / SJW` | CAN FD 使用 BRS 时的数据速率阶段 | 暂不决定经典 CAN 报文速率 |

所以界面上的 Data 参数即使是 1，也不能据此断言你当前经典 CAN 采用了某个“数据段高速波特率”。

## FDCAN Message RAM：4 个元素究竟代表什么？ {#ram}

FDCAN 的过滤表、收发 FIFO、接收缓冲区和发送事件 FIFO 存在专用 Message RAM 布局中。这些配置定义的是内存结构，而不是 CAN 线上数据帧的长度。

| CubeIDE 字段 | 示例值 | 作用与注意点 |
| --- | --- | --- |
| `Message RAM Offset` | 0 | 该 FDCAN 实例在共享 Message RAM 中的起始偏移；FDCAN1/2 区域不得重叠。 |
| `Std Filters Nbr` | 1 | 预留 1 个标准 ID 过滤元素；需要再调用 HAL 配置过滤规则。 |
| `Ext Filters Nbr` | 0 | 不预留扩展 ID 过滤元素。 |
| `Rx FIFO0 Elmts Nbr` | 4 | FIFO0 可缓存最多 4 条未取走的接收报文；不是 4 Byte。 |
| `Rx FIFO0 Elmt Size` | 8 bytes | 每个元素的数据字段容量为 8 字节，适合 Classic CAN；另外还要存头部元数据。 |
| `Rx FIFO1 Elmts Nbr` | 0 | 暂不使用第二个接收 FIFO。 |
| `Rx Buffers Nbr` | 0 | 不使用专用接收 Buffer。 |
| `Tx Events Nbr` | 0 | 不记录发送事件 FIFO；发送事件本身与发送完成中断不同。 |
| `Tx Buffers Nbr` | 0 | 不用专用发送 Buffer。 |
| `Tx FIFO/Queue Elmts Nbr` | 4 | 为待发送报文预留 4 个元素。 |
| `Tx FIFO/Queue Mode` | FIFO | 按发送 FIFO 机制管理待发送请求；与 Queue 模式的选择有别。 |
| `Tx Elmt Size` | 8 bytes | 每个发送元素承载最多 8 字节数据字段。 |

### 内存大约占多少？

以标准 ID 过滤器 ×1、Rx FIFO0 ×4（每元素 8B header + 8B data）、Tx FIFO ×4（同样 16B）为例：

```text
标准 ID Filter  : 1 ×  4B =   4B
Rx FIFO0       : 4 × 16B =  64B
Tx FIFO        : 4 × 16B =  64B
--------------------------------
合计（此示例）：           132B = 33 个 32-bit word
```

这是仅对已配置区域进行的基本内存布局计算，不代表当前整个 FDCAN 子系统只有 132B RAM，也不替代实际生成代码对双 FDCAN 共享布局的验证。

### 过滤器与 FIFO 是两个不同层次

收到完整 CAN 帧（ID / DLC / Data） → 过滤规则（决定接受及投递位置） → Rx FIFO0 / FIFO1（排队等待 CPU 读取）

例如 `FilterID1=0x123`、掩码 `FilterID2=0x7FF`（11 位全比较），可以只匹配标准帧 ID 0x123；`StdFiltersNbr=1` 本身只是预留空间，**不会自动写入这个过滤规则**。

此外还要检查 `HAL_FDCAN_ConfigGlobalFilter`，因为不匹配单独过滤器的报文也会按照全局过滤规则处理，不能凭“只配置了一条 Filter”就断言其他报文全被拒绝。

## 中断、FIFO 与 FreeRTOS：你最关心的实际处理链 {#irq}

### NVIC 的三项配置是什么意思？

| 配置项 | 含义 | 初期建议 |
| --- | --- | --- |
| `FDCAN1 interrupt 0` | FDCAN1 的第 0 条中断线路；可承载 FIFO0 收到报文等事件 | 启用 |
| `FDCAN1 interrupt 1` | 同一个 FDCAN1 的第 1 条中断线路，允许单独映射其他事件 | 先关闭 |
| `FDCAN calibration unit interrupt` | FDCAN 时钟校准单元相关，不是每收一帧必须开的中断 | 先关闭 |

**注意：**这两条 `interrupt 0/1` 不是 FDCAN1/FDCAN2。你可以把不同事件映射到不同中断线路，但现在不必复杂化。

报文被放入 Rx FIFO0（FDCAN 硬件） → 控制器事件标志（NEW_MESSAGE / WATERMARK / FULL） → NVIC IT0（进入 ISR） → HAL 回调（GetRxMessage 取走数据） → FreeRTOS 队列（网关任务后续处理）

### 三个“开关”缺一不可

1. **NVIC 启用：**CubeIDE 中勾选 `FDCAN1 interrupt 0`，生成 `FDCAN1_IT0_IRQHandler()`。
2. **控制器通知启用：**`HAL_FDCAN_ActivateNotification(&hfdcan1, FDCAN_IT_RX_FIFO0_NEW_MESSAGE, 0)`。
3. **回调与 FIFO 读取：**在 `HAL_FDCAN_RxFifo0Callback()` 内，通过 `HAL_FDCAN_GetRxMessage()` 从 FIFO 取走报文。

### FIFO0 中断演示

假设 FIFO 深度为 4 帧。切换中断条件后逐帧接收，观察事件在何时产生。

<FdcanFifo />

| 事件 | 什么时候触发 | 是否适合实时网关 |
| --- | --- | --- |
| `FDCAN_IT_RX_FIFO0_NEW_MESSAGE` | 每有一条新报文进入 FIFO 时设置事件标志 | 推荐 |
| `FDCAN_IT_RX_FIFO0_WATERMARK` | FIFO 占用到达你配置的阈值时触发 | 可用于批处理；单帧可能等待下一帧 |
| `FDCAN_IT_RX_FIFO0_FULL` | 4 个元素都被占用时触发 | 适合预警，不能作为低延迟主接收机制 |
| `FDCAN_IT_RX_FIFO0_MESSAGE_LOST` | 由于 FIFO 条件等原因丢失接收报文 | 建议监测 |

**默认水位不是 1：**硬件水位字段为 0 时，水位中断禁用。你的 FIFO 深度设为 4 只代表缓存能力，不会自动变成“第 4 条才中断”；是否每条通知取决于你启用的事件。

### H7 HAL 最小调用关系（示意）

```c
/* 先由 CubeMX 完成 MX_FDCAN1_Init() */
/* 随后配置接收 Filter / GlobalFilter：本节省略具体规则 */

HAL_FDCAN_ActivateNotification(
    &hfdcan1, FDCAN_IT_RX_FIFO0_NEW_MESSAGE, 0);
HAL_FDCAN_Start(&hfdcan1);

/* Core/Src/stm32h7xx_it.c 通常由 CubeMX 生成 */
void FDCAN1_IT0_IRQHandler(void)
{
    HAL_FDCAN_IRQHandler(&hfdcan1);
}

/* 用户代码：收到报文后从 FIFO 取走 */
void HAL_FDCAN_RxFifo0Callback(FDCAN_HandleTypeDef *hfdcan,
                                uint32_t it)
{
    if (hfdcan->Instance != FDCAN1 ||
        !(it & FDCAN_IT_RX_FIFO0_NEW_MESSAGE)) return;

    FDCAN_RxHeaderTypeDef hdr;
    uint8_t data[8];
    while (HAL_FDCAN_GetRxFifoFillLevel(hfdcan,
                                        FDCAN_RX_FIFO0) > 0U) {
        if (HAL_FDCAN_GetRxMessage(hfdcan,
                                   FDCAN_RX_FIFO0,
                                   &hdr, data) != HAL_OK) break;
        /* 复制到用户定义的数据结构；发送到 FreeRTOS 队列 */
    }
}
```

:::tip 要点
**重要：**这是逻辑骨架，不是直接可编译的整套工程；实际还需配置 Filter / GlobalFilter、完整错误检查和任务队列。使用 `xQueueSendFromISR()` 时，要保证 ISR 优先级符合 FreeRTOS 限制。
:::

### FreeRTOS 中断优先级怎么理解？

STM32 NVIC 中较小的优先级数值代表较高抢占优先级。你截图里的 Preemption Priority = 5，是否适合在回调中调用 `xQueueSendFromISR()`，取决于 `FreeRTOSConfig.h` 中的 `configLIBRARY_MAX_SYSCALL_INTERRUPT_PRIORITY`。在常见配置下，允许调用 FreeRTOS ISR API 的中断数值应不小于该阈值（并须匹配优先级位数与分组）。

中断回调只做**快速取帧、复制结构、入队、必要时请求任务切换**；ID 过滤后的路由策略、统计和发送由 FreeRTOS 任务完成。不要在 ISR 中执行长时间等待、阻塞式打印或重计算。

## 没有真实 ECU：从内部回环到双 CAN 网关 {#test}

#### 阶段 A · 无外设

FDCAN1 Internal Loopback；一个 MCU 就能验证过滤器、FIFO、接收中断和 HAL 回调。

#### 阶段 B · 接入 RTOS

接收回调 → 队列 → FreeRTOS 网关任务；记录帧 ID、时间戳、队列溢出与处理时延。

#### 阶段 C · 真实总线

加 CAN 收发器、终端电阻、第二节点（另一块 MCU 或 USB-CAN）；验证 ACK、负载和 CAN1↔CAN2 转发。

### 内部回环最小验证顺序

1. 确认 `FDCAN1 → Internal LoopBack mode` 和 Classic CAN。
2. 先核对 HSE / FDCAN 内核时钟真正在工作；示例为 25 MHz。
3. 按示例配置 500 kbit/s、标准 ID Filter 1 个、Rx FIFO0 4 个、Tx FIFO 4 个。
4. 初始化后配置 Filter（如仅收标准 ID `0x123`）以及全局过滤策略。
5. 勾选 NVIC 的 FDCAN1 interrupt 0；调用 `HAL_FDCAN_ActivateNotification`。
6. 启动 FDCAN；发送一帧 ID=0x123、数据为 `11 22 33 44`。
7. 在 `HAL_FDCAN_RxFifo0Callback()` 设置断点，核实帧 ID、DLC、Payload 是否一致。
8. 从断点转向统计计数，再用 FreeRTOS 队列验证长时间稳定性。

:::warning 注意
**边界要分清：**内部回环成功不能证明物理 CAN 总线可用。外部测试还涉及收发器、接线、终端、电平兼容、共同标称位速率、ACK、布线噪声等。没有真实 ECU 时，可以用第二块 MCU 模拟 CAN 节点；要练习 UDS，再在其上实现一个极简的 UDS 服务端。
:::

### 做成可展示的工程，建议留下哪些证据？

<GatewayChecklist :items="checks" />

## 容易踩的坑：现象 → 根因 → 检查位置 {#errors}

### NVIC 已勾选，但没有收到中断

确认：FDCAN 是否已 `HAL_FDCAN_Start()`；是否调用了 `HAL_FDCAN_ActivateNotification`；是否正确配置过滤器及全局过滤；FIFO0 元素数是否非 0；FDCAN1 interrupt 0 是否映射到预期线路；是否有有效报文被接收。

### 配了 4 个 FIFO 元素，是不是收够 4 帧才中断？

不是。元素数是缓存容量。若启用 `NEW_MESSAGE`，每有新报文入 FIFO 就产生事件；若启用 `FULL`，满时才触发；若启用 `WATERMARK`，按配置阈值触发。水位字段为 0 时水位通知禁用。

### SYSCLK=64 MHz，我明明已经配了 PLL，为什么没加速？

PLL 被配置不代表被系统时钟多路复用器选中。打开 Clock Configuration，沿 `System Clock Mux → SYSCLK → CPU clock` 的实线看实际选源；还需检查 HPRE/D1CPRE 等分频。

### HSE_VALUE=25000000，但 FDCAN 还是不工作

检查板上的外部晶振/时钟源是否与 25 MHz 一致，HSE 模式是 Crystal 还是 Bypass、HSE 实际是否起振、FDCAN kernel clock 选源是否正确；不要只看宏定义。

### Internal Loopback 正常，实际 CAN 连接不通

依次查：是否有外部 CAN 收发器、TXD/RXD 方向、CANH/CANL 走线、共地/隔离方案、终端、供电、两节点标称速率及采样点、总线 ACK、错误状态、模式是否还停留在 Loopback。

### 我配置了 1 个 Filter，为什么其他 ID 还能进入 FIFO？

`StdFiltersNbr=1` 只是预留过滤器槽位。是否配置了 `HAL_FDCAN_ConfigFilter`？不匹配的帧还受 `HAL_FDCAN_ConfigGlobalFilter` 决定。

### 进入回调，却出现 FreeRTOS assert 或卡死

检查 NVIC 优先级和 `configLIBRARY_MAX_SYSCALL_INTERRUPT_PRIORITY`，是否使用了 `FromISR` API，队列句柄是否已创建，是否在 ISR 中调用阻塞 API、printf 或长时间循环。

### CAN FD 的 Data 参数改了，Classic CAN 速率为何不变？

Classic CAN 整帧使用 Nominal Bit Timing。Data Bit Timing 主要服务于 CAN FD 中启用 BRS 的数据阶段，不能直接影响经典 CAN 帧。

## 速查：API、汇编与可靠参考资料 {#appendix}

| 名字 | 一句话作用 |
| --- | --- |
| `MX_FDCAN1_Init()` | 由配置生成 FDCAN1 句柄、位时序和 Message RAM 相关初始化。 |
| `HAL_FDCAN_ConfigFilter()` | 配置某个 ID 过滤规则和接收位置。 |
| `HAL_FDCAN_ConfigGlobalFilter()` | 定义未匹配规则的标准/扩展帧和远程帧如何处理。 |
| `HAL_FDCAN_ActivateNotification()` | 启用特定 FDCAN 事件的中断通知。 |
| `HAL_FDCAN_ConfigFifoWatermark()` | 设置接收 FIFO / Tx Event FIFO 的水位阈值。 |
| `HAL_FDCAN_GetRxFifoFillLevel()` | 读取 FIFO 当前已有多少个报文元素。 |
| `HAL_FDCAN_GetRxMessage()` | 从指定 FIFO 读取一个接收报文。 |
| `HAL_FDCAN_AddMessageToTxFifoQ()` | 向发送 FIFO/Queue 提交一条待发送报文。 |
| `HAL_FDCAN_RxFifo0Callback()` | 用户接收事件回调，可在其中尽快取帧入队。 |

### 顺带解释：你之前贴过的 ARM 汇编读—改—写

```asm
bl   HAL_GPIO_TogglePin  ; 调用函数，可能翻转 LED
ldr  r3, [pc, #24]       ; 从 PC 相对位置加载一个字（可能是地址）
ldr  r3, [r3, #0]       ; 读取该地址中的值
adds r3, #1             ; 对寄存器中的值 +1
str  r3, [r2, #0]       ; 写到 r2 指向的地址！
```

前三步可理解为“得到地址 → 读旧值 → 加 1”。但最后写回用的是 `r2` 而不是 `r3` 原地址，**必须确认 r2 当时的值**，才能断言写回的确是同一个 `g_heartbeat`。这就是看汇编时不能只根据变量注释猜测程序行为的原因。

### 推荐直接读的官方资料

- [ST RM0433 · STM32H743 参考手册](https://www.st.com/resource/en/reference_manual/rm0433-stm32h742-stm32h743-753-and-stm32h750-value-line-advanced-armbased-32bit-mcus-stmicroelectronics.pdf) —— 以 RCC、GPIO、FDCAN、Memory Map 的寄存器定义为最终依据。
- [ST AN5348 · Introduction to FDCAN peripherals](https://www.st.com/resource/en/application_note/an5348-fdcan-peripheral-on-stm32-devices-stmicroelectronics.pdf) —— CAN FD 特性、滤波器、FIFO、中断。
- [ST 官方 STM32H7 HAL 驱动源码](https://github.com/STMicroelectronics/stm32h7xx-hal-driver) —— 直接查 HAL API 参数、条件检查和中断回调逻辑。
- [ST STM32CubeH7 示例工程](https://github.com/STMicroelectronics/STM32CubeH7) —— FDCAN 相关示例、时钟/外设配置范式。
- [FreeRTOS 官方文档](https://www.freertos.org/) —— 任务、队列、ISR API 与 NVIC 优先级约束。

资料链接用于后续深入核对，正文和交互计算均可在本页使用。不同 HAL / CubeMX 版本，宏与文件组织可能存在差异；以你的工程实际头文件为准。

:::tip 要点
**最后的学习路线建议：**先把时钟、过滤器、FIFO 和中断串起来，再用 FreeRTOS 队列和任务建可观察的数据流。等能够统计丢帧、时延、CPU 占用后，再评价是否需要调高主频、增加 FIFO 深度、改变中断策略。比单纯记住 CubeMX 每个参数更接近真实嵌入式工程能力。
:::
