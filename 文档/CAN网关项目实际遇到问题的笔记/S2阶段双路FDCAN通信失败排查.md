<script setup>
import originalDocument from '../../原始资料/在实施S2阶段任务时遇到的了CAN通信不成功的问题.docx?url'
import sourceWave from './图片/S2双路FDCAN通信失败-逻辑分析仪波形.png'
</script>

# S2阶段双路FDCAN通信失败排查

记录由一路 FDCAN 转为双路收发时，上位机收不到数据的排查经过，包括寄存器观察、逻辑分析仪波形和独立供电后的结果。

<a :href="originalDocument" download>下载完整 Word 原件</a>

## 文档完整内容 {#source-content}

以下保留原文顺序、全部文字、波形图片和表格。文中的二极管钳位与供电原因属于当时的排查推测，记录中的复验结果为改用独立供电后通信恢复。

在实施S2阶段任务时遇到的了CAN通信不成功的问题；

以下是方便理解的润色过的版本：

在实施 S2 阶段任务时，遇到了 CAN 通信不成功的问题。

### 调试起点 {#initial-setup}

首先在刚开始学习 CAN 总线的时候，完成一路 FDCAN 通信后想尝试双路 FDCAN 通信，于是把程序修改为双路收发。刚开始调试时先把 FDCAN 配置成不自动重发，也就是 FDCAN 寄存器 FDCAN_CCCR-&gt;DAR 置位。编译通过后把程序烧进单片机，运行发现上位机收不到数据。

### 寄存器与接收指示 {#register-observations}

这个时候我对是哪出问题也没有思路，不知道是程序改错了还是接线松动。检查完接线后，就先在 H743 核心板的 FDCAN 输入输出引脚、CAN 收发器的 TX 和 RX 引脚测试点、还有收发器的 CANH 和 CANL 测试点上都挂上逻辑分析仪的挂钩。然后在程序 FDCAN 函数里发送的 API 后面打了断点，读了下变量和寄存器，发现 TXBTO、TXBCR 都是 0，TXBCF 每次暂停都会增加，最后变成 0xF；收发器的 RX 指示灯也一直不闪，说明总线上根本没有节点应答。

### 阈值与波形观察 {#signal-observations}

然后重新运行程序观察逻辑分析仪的通道波形，发现阈值电压调到 1.8V 和 2.8V 时，CANH 和 CANL 都没有波形，说明总线根本没被驱动；FDCAN 的 TX 引脚在 2.8V 阈值也检测不到，逐步降到 0.7V 以下才出现波形。正常 3.3V 逻辑不该这样，考虑了一下，怀疑是不是哪个电路的二极管把电压钳在 0.7V 附近，让核心板的上拉电阻拉不高电压。

### 供电调整与复验 {#power-change}

这时候虽然不确定程序有没有问题，但感觉问题应该出在收发器上。收发器的电源指示灯是正常的，但还是怀疑它供电不足、二极管没导通。又想到，收发器的 5V 供电是从核心板 5V 引脚取的，而核心板又是通过 ST-LINK 的 5V 引脚供电，有可能分压之后带载能力不足。于是把收发器改成独立供电，工作就正常了。

### 原文波形与通道表格 {#source-figure}

<a :href="sourceWave" target="_blank" rel="noopener"><img :src="sourceWave" alt="原文中的逻辑分析仪采集波形，通道说明见下文"></a>

Channel1是CANH，channel0是CANL其中3,4是两个TX

<div class="source-table">
<table>
<tbody>
<tr><td>CH0</td><td>CANL</td><td>2.5 V</td><td>1.5 V</td><td>显性会跌到阈值附近 → 有波形</td></tr>
<tr><td>CH1</td><td>CANH</td><td>2.5 V</td><td>3.5 V</td><td>两个电平都在 1.5 V 以上 → 一直高，无波形</td></tr>
</tbody>
</table>
</div>
