# STM32H743 的 MPU 区域配置

读 CubeMX 生成的 `MPU_Config()` 时，先确定哪条区域规则匹配地址，再看它指定的权限和内存属性。

## 地址、权限和缓存 {#memory-attributes}

芯片的[存储映射](./STM32H743存储映射.md)决定地址对应哪块 RAM 或哪组外设寄存器。MPU 为 CPU 访问配置读写权限、特权限制、取指权限（XN）和内存属性。普通 SRAM 的访存路径支持缓存、有效属性允许缓存且 D-Cache 已启用时，数据访问才可能使用 D-Cache。TCM 使用专用路径。

普通 RAM 可以配置为 Normal Non-cacheable。Device 和 Normal Non-cacheable 的访问顺序等语义不同，MMIO 应遵守架构与芯片手册的属性要求。`volatile` 约束编译器生成的访问，见 [MMIO 与 volatile](./MMIO与volatile.md)。DMA 可达性、缓存行对齐和 Clean/Invalidate 的处理见 [Cache 与 DMA 一致性](./Cache与DMA一致性.md)。

## Region 编号、基址和大小 {#region-fields}

STM32H743 的 MPU 有 16 个槽位，编号 0～15。编号可以跳用。同一槽位可重新配置。若多个启用区域匹配同一地址，编号最大的匹配区域生效。

| HAL 字段 | 用途 |
| --- | --- |
| `Number` | 选定待配置的硬件槽位 |
| `BaseAddress` | 区域起始地址，按区域大小对齐 |
| `Size` | 区域大小，使用硬件支持的 2 的幂 |
| `SubRegionDisable` | 区域至少为 256 字节时，可按位关闭 8 个等大的子区域 |

```c
MPU_InitStruct.Number      = MPU_REGION_NUMBER1;
MPU_InitStruct.BaseAddress = 0x24000000U;
MPU_InitStruct.Size        = MPU_REGION_SIZE_512KB;
```

Region 1 匹配 `0x24000000–0x2407FFFF`。这是地址字段示例，完整配置还需填写使能、权限和内存属性，再由 HAL 写入。D2 SRAM 总计 288 KiB，可按 SRAM1、SRAM2、SRAM3 分别配置 128、128、32 KiB，或按合法区域大小与子区域规划。MPU 没有 288 KiB 的单区域编码。

## 4 GiB 区域与 0x87 掩码 {#subregion-mask}

```c
MPU_InitStruct.Number           = MPU_REGION_NUMBER0;
MPU_InitStruct.BaseAddress      = 0x00000000U;
MPU_InitStruct.Size             = MPU_REGION_SIZE_4GB;
MPU_InitStruct.SubRegionDisable = 0x87U;
MPU_InitStruct.AccessPermission = MPU_REGION_NO_ACCESS;
MPU_InitStruct.DisableExec      = MPU_INSTRUCTION_ACCESS_DISABLE;
```

子区域大小等于区域大小除以 8，本例每段为 512 MiB。子区域从基址按低地址到高地址编号。`0x87` 的 bit 0、1、2、7 置位，对应地址跳过 Region 0 匹配。bit 3～6 清零，Region 0 在 `0x60000000–0xDFFFFFFF` 匹配并应用 `NO_ACCESS` 和 XN，除非有更高编号的启用区域覆盖相同地址。

启用 `MPU_PRIVILEGED_DEFAULT` 后，没有有效区域匹配的特权访问使用处理器的默认内存映射。非特权访问仍须由有效区域授权。判断缓存行为时，继续核对最终匹配的内存属性和 Cache 使能状态。

## 参考资料

[ST AN4838 · STM32 MPU 配置](https://www.st.com/resource/en/application_note/an4838-introduction-to-memory-protection-unit-management-on-stm32-mcus-stmicroelectronics.pdf) · [STM32H742/H743 数据手册](https://www.st.com/resource/en/datasheet/stm32h743bg.pdf)
