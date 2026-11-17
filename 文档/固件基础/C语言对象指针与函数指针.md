# C 语言对象指针与函数指针

从 `void *`、丢弃表达式结果和函数指针声明入手，读懂 RTOS 创建接口与驱动回调。

## void 指针与丢弃表达式结果 {#void-expressions}

| 写法 | 含义 |
| --- | --- |
| `void *p;` | 声明一个可承载对象地址的指针 |
| `(void *)somePtr` | 把对象指针转换为 `void *` |
| `(void)argument;` | 求值并丢弃结果，常用于标明刻意忽略参数 |
| `(void)Transmit(data);` | 执行调用并丢弃返回值。若需要判断发送请求是否提交成功，应检查返回值 |

通过 `void *` 读取对象之前，应转换回兼容的对象指针类型，并确认对象仍有效。标准 C 保证对象指针与 `void *` 的往返转换。函数地址应使用与目标函数签名匹配的函数指针。

```c
int x = 100;
void *p = &x;
int value = *(int *)p;  // 100
```

## 函数指针声明与调用 {#function-pointers}

```c
static int Add(int a, int b) { return a + b; }

void Example(void)
{
    int (*pFunc)(int, int) = Add;
    int result = pFunc(3, 5);  // 8
    (void)result;
}

typedef void (*ThreadEntry)(void *argument);
```

`int (*pFunc)(int, int)` 声明指向函数的指针。`int *pFunc(int, int)` 声明返回 `int *` 的函数。括号决定 `*` 与名称如何结合。`typedef` 为完整的函数指针类型命名，便于多个入口共用签名。

## 运行时切换函数指针 {#switch-function-target}

沿用上面的 `Add`，再定义一个具有相同签名的函数。

```c
static int Multiply(int a, int b) { return a * b; }

void SwitchExample(void)
{
    int (*operation)(int, int) = Add;
    int sum = operation(3, 5);       // 8

    operation = Multiply;
    int product = operation(3, 5);   // 15
    (void)sum;
    (void)product;
}
```

赋值改变的是指针变量保存的调用目标。后续调用执行已有的 `Multiply` 代码，程序无需重写 Flash。作为实参传递 `Multiply` 时，函数名会转换成函数指针，写成 `Multiply(3, 5)` 才会立即执行函数。指针若由多个任务或 ISR 共享，应先约定谁负责更新与调用。

## 回调、任务入口与命令分发 {#callbacks}

函数指针适合驱动回调、任务入口和命令分发表。调用前核对签名和初始化状态。回调还要核对执行上下文和并发约束。固定分支较少时，`if` 或 `switch` 往往更直接，间接调用的内联能力也依编译器能否确定目标而定。

驱动如何保存并调用注册的函数见 [FDCAN 应用层回调](../外设通信/FDCAN网关/消息存储与收发中断.md#application-rx-callback)，任务入口签名见 [CMSIS-RTOS2 线程创建与参数](../实时系统/CMSIS-RTOS2线程创建与参数.md)。

[C 标准委员会草案 N1570 · §6.3.2.1–3、§6.7.6.3](https://www.open-std.org/jtc1/sc22/wg14/www/docs/n1570.pdf)
