# STM32CubeIDE 断点不命中排查

适用于通过 ST-LINK 调试 STM32。先确认调试器能否暂停目标，再检查断点是否已安装、对应地址是否正确，以及程序是否真的执行到该地址。

## 先用 Suspend 分流 {#suspend-check}

| 观察结果 | 下一步 |
| --- | --- |
| **Suspend** 无法让目标暂停 | 查看 GDB Server 日志，核对供电、SWD 接线、ST-LINK 和连接模式 |
| 能暂停并读取 PC 或调用栈 | 当前会话能控制内核。继续核对断点和所用 ELF |
| 能暂停，且 `main()` 已执行过 | 若要验证入口断点，重新启动或按工程配置复位后运行 |

能暂停只证明当前会话可以控制内核。要确认目标运行的是当前构建，还要检查镜像下载、符号和实际停机位置。

## 确认断点已启用、已解析并成功安装 {#breakpoint-binding}

1. 在 **Breakpoints** 视图确认关闭了 **Skip All Breakpoints**，目标断点已启用，条件或命中次数符合预期。
2. 会话启动前设置断点是正常用法。连接后再核对该断点是否安装成功。Eclipse CDT 用勾选标记区分已安装的启用断点。图标没显示已安装时，结合 **Breakpoints** 和 Console 状态判断原因。
3. 用带调试信息的 ELF 对照 **Disassembly**。确保源代码行有实际指令，核对断点地址。优化、内联或一行对应多条指令都可能让停机位置和预期源码行不同。可先在函数入口或明确的指令处做一次对照。
4. 断点地址正确但仍不停，就检查代码路径是否实际执行，或是否是需要重新触发的外设事件。Console 若提示硬件断点无法插入，先减少同时启用的断点，再观察是否恢复。

[Eclipse CDT 断点说明](https://help.eclipse.org/latest/rtopic/org.eclipse.cdt.doc.user/concepts/cdt_c_brkpnts.htm) · [GDB 断点地址与状态](https://sourceware.org/gdb/current/onlinedocs/gdb.html/Set-Breaks.html) · [Thumb-2 指令与寻址](./Cortex-M7汇编/Thumb-2指令与寻址.md)

## 核对 ELF 与启动配置 {#launch-configuration}

1. 结束旧调试会话，确认当前构建配置。必要时执行 **Project → Clean** 再构建。
2. 在 **Run → Debug Configurations** 的 **Main** 页核对 Project 和 C/C++ Application，确保选中本次构建生成的 ELF。工程换路径或工作区后先核对现有 `.launch`，有错就修正或新建。
3. 在 **Debugger** 页核对探针、SWD 和复位方式。硬件复位依赖探针的复位线接到目标 NRST。目标可连接且没有这条接线时，可按板卡和当前下载流程选择 **Software system reset**。下载镜像时，具体复位行为还受 ST-LINK GDB Server 的烧录流程影响。
4. 做基线验证时，在 **Startup** 页启用 **Set breakpoint at: main**。如果准备重新下载，核对加载镜像、符号和 Console 的下载验证结果。确认程序先停在 `main()`，再用已知会执行的位置验证普通断点。

[STM32CubeIDE 用户指南 UM2609](https://www.st.com/resource/en/user_manual/um2609-getting-started-with-stm32cubeide-stmicroelectronics.pdf) · [FDCAN1 Normal 模式实测记录](../外设通信/FDCAN网关/联调与故障排查.md#s2a-breakpoint-case)
