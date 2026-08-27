---
title: Transformer的矩阵变换
date: 2026-08-27 15:30:51
cover: /images/2026/08/76808ee94a19-pasted-image-20260827152047.png
description: "本文基于《Attention Is All You Need》经典论文超参数，全流程图解与推导 Transformer 架构中编码器与解码器的矩阵维度变换流转。"
tags:
- mcl
- transformer
- deep-learning
- attention-mechanism
- matrix-operations
related:
- '[[the_annotated_transformer]]'
- '[[Adam 偏差修正推导]]'
- '[[pytorch约定规则]]'
aliases:
- Transformer矩阵变换
---

![Pasted image 20260827152047](/images/2026/08/76808ee94a19-pasted-image-20260827152047.png)

本文将**严格使用《Attention Is All You Need》论文中的原始超参数**：
*   模型维度（Embedding/隐藏层）：$d_{model} = 512$
*   注意力头数：$h = 8$
*   每个头的维度：$d_k = d_v = 512 / 8 = 64$
*   前馈神经网络隐藏层维度：$d_{ff} = 2048$

为了能够在平面上画出矩阵，我们假设：
*   **Batch Size ($B$) = 1**（忽略批次维度，把张量降维成 2D 矩阵展示）
*   **编码器输入序列长度 ($L$) = 4**（比如输入句子是 "I love machine learning"）
*   **解码器输入序列长度 ($M$) = 3**（比如翻译成中文 "我 爱 机器"）
*   词表大小 ($V$) = 30000


### 总结核心矩阵流转（以序列长度 $L$代替数字）
1. `[L, 512]` (输入特征)
2. `[L, 512]` $\times$ `[512, 512]` $\rightarrow$ `[L, 512]` (生成QKV)
3. `[L, 512]` $\rightarrow$ 切割多头 $\rightarrow$ `8个 [L, 64]`
4. `[L, 64]` $\times$ `[64, L]` $\rightarrow$ `[L, L]` (注意力矩阵，这是Transformer内存瓶颈所在！)
5. `[L, L]` $\times$ `[L, 64]` $\rightarrow$ `[L, 64]` (加权后的Value)
6. 拼合多头 $\rightarrow$ `[L, 512]`
7. `[L, 512] + [L, 512]` $\rightarrow$ `[L, 512]` (Add 残差连接)
8. `[L, 512]` $\rightarrow$ `[L, 512]` (LayerNorm 层归一化)
9. `[L, 512]` $\times$ `[512, 2048]` $\rightarrow$ `[L, 2048]` (FFN升维)
10. `[L, 2048]` $\times$ `[2048, 512]` $\rightarrow$ `[L, 512]` (FFN降维)
11. `[L, 512] + [L, 512]` $\rightarrow$ `[L, 512]` (Add 残差连接)
12. `[L, 512]` $\rightarrow$ `[L, 512]` (LayerNorm 层归一化 → Encoder 最终输出 $M_{enc}$)
---

### 第一阶段：输入处理 (Input Processing)

#### 1. 词嵌入 (Word Embedding)

Embedding 层的本质是一个**巨大的查找表矩阵** $W_{emb} \in \mathbb{R}^{V \times d_{model}} = \mathbb{R}^{30000 \times 512}$，每一行存储词表中一个 token 的稠密向量表示（训练开始时随机初始化，随训练不断优化）。

$$ W_{emb} = \begin{bmatrix} 
\leftarrow & \text{词表中第 1 号词的 512 维向量} & \rightarrow \\
\leftarrow & \text{词表中第 2 号词的 512 维向量} & \rightarrow \\
& \vdots & \\
\leftarrow & \text{词表中第 30000 号词的 512 维向量} & \rightarrow 
\end{bmatrix}_{30000 \times 512} $$

**参数规模：** $30000 \times 512 = 15,\!360,\!000$（约 1536 万参数），在 Base 模型（~6500 万）中占比约 $24\%$，是除 FFN 外最大的参数块。

输入 4 个 Token ID（例如 `[42, 156, 7890, 234]`），直接从 $W_{emb}$ 中「按行索引」取出对应的四行，拼成 $X_{emb}$。这是一个**离散查表**操作，不涉及矩阵乘法。
维度转换：`[4]` $\rightarrow$ `[4, 512]`

$$ X_{emb} = \begin{bmatrix} 
\leftarrow & \text{Token}_1 \text{ ("I") 的词向量 (长度512)} & \rightarrow \\
\leftarrow & \text{Token}_2 \text{ ("love") 的词向量 (长度512)} & \rightarrow \\
\leftarrow & \text{Token}_3 \text{ ("machine") 的词向量 (长度512)} & \rightarrow \\
\leftarrow & \text{Token}_4 \text{ ("learning") 的词向量 (长度512)} & \rightarrow 
\end{bmatrix}_{4 \times 512} $$

#### 2. 位置编码 (Positional Encoding)

Transformer 没有 RNN 的顺序概念，必须注入位置信息。论文使用正弦/余弦函数构造固定位置编码：

$$
PE_{(pos,\,2i)} = \sin\!\left( \frac{pos}{10000^{\,2i/d_{model}}} \right)
\qquad
PE_{(pos,\,2i+1)} = \cos\!\left( \frac{pos}{10000^{\,2i/d_{model}}} \right)
$$

其中 $pos \in \{0, 1, \dots, L-1\}$ 为 token 在序列中的位置，$i \in \{0, 1, \dots, 255\}$ 为维度索引（共 $d_{model}/2 = 256$ 对 sin/cos）。偶数维度用 $\sin$，奇数维度用 $\cos$。

*(直观理解：每个位置 $pos$ 对应一条 512 维的位置向量。不同维度 $i$ 对应不同波长的正弦波——低维度波动快（高频），高维度波动慢（低频），形成类似二进制的"位置指纹"。因为 $\sin(\alpha+\beta) = \sin\alpha\cos\beta + \cos\alpha\sin\beta$，模型可以通过线性变换学到相对位置关系。)*

PE 矩阵维度与 $X_{emb}$ 完全一致。维度转换：`[4, 512] + [4, 512]` $\rightarrow$ `[4, 512]`

$$ X = X_{emb} + PE = \begin{bmatrix} 
\leftarrow & x_1 \text{ (Token}_1 \text{ 融合了位置0的信息)} & \rightarrow \\
\leftarrow & x_2 \text{ (Token}_2 \text{ 融合了位置1的信息)} & \rightarrow \\
\leftarrow & x_3 \text{ (Token}_3 \text{ 融合了位置2的信息)} & \rightarrow \\
\leftarrow & x_4 \text{ (Token}_4 \text{ 融合了位置3的信息)} & \rightarrow 
\end{bmatrix}_{4 \times 512} $$

这个 $X$ 就是接下来进入 Encoder 核心组件的输入矩阵。

> [!note]- 此处会做 **Dropout**（$P=0.1$），详见 [[#4. Dropout 正则化|Dropout 正则化]]

---

### 第二阶段：编码器 (Encoder Block)

#### 1. 生成 Q、K、V 矩阵
将输入矩阵 $X$ 分别乘以三个权重矩阵 $W^Q, W^K, W^V$。论文中这三个权重矩阵维度都是 $512 \times 512$。
维度转换：`[4, 512] @ [512, 512]` $\rightarrow$ `[4, 512]`

$$ Q = X \times W^Q = \begin{bmatrix} \leftarrow q_1 \rightarrow \\ \leftarrow q_2 \rightarrow \\ \leftarrow q_3 \rightarrow \\ \leftarrow q_4 \rightarrow \end{bmatrix}_{4 \times 512} \quad 
K = X \times W^K = \begin{bmatrix} \leftarrow k_1 \rightarrow \\ \leftarrow k_2 \rightarrow \\ \leftarrow k_3 \rightarrow \\ \leftarrow k_4 \rightarrow \end{bmatrix}_{4 \times 512} \quad 
V = X \times W^V = \begin{bmatrix} \leftarrow v_1 \rightarrow \\ \leftarrow v_2 \rightarrow \\ \leftarrow v_3 \rightarrow \\ \leftarrow v_4 \rightarrow \end{bmatrix}_{4 \times 512} $$

#### 2. 拆分多头 (Multi-Head Split)
论文设定 $h=8$，我们要把 512 维度切分成 8 份，每份 64 维（$d_k=64$）。
维度转换：`[4, 512]` $\rightarrow$ Reshape为 `[4, 8, 64]` $\rightarrow$ 转置为 `[8, 4, 64]`。
*直观理解：现在我们有 8 个平行的注意力头。我们单独拿**第 1 个头 (Head 1)** 的矩阵来看看：*

$$ Q_1 = \begin{bmatrix} 
\leftarrow q_{1,1} \text{ (长度64)} \rightarrow \\ 
\leftarrow q_{2,1} \text{ (长度64)} \rightarrow \\ 
\leftarrow q_{3,1} \text{ (长度64)} \rightarrow \\ 
\leftarrow q_{4,1} \text{ (长度64)} \rightarrow 
\end{bmatrix}_{4 \times 64} \quad
K_1 = \begin{bmatrix} \leftarrow k_{1,1} \rightarrow \\ \leftarrow k_{2,1} \rightarrow \\ \leftarrow k_{3,1} \rightarrow \\ \leftarrow k_{4,1} \rightarrow \end{bmatrix}_{4 \times 64} \quad
V_1 = \begin{bmatrix} \leftarrow v_{1,1} \rightarrow \\ \leftarrow v_{2,1} \rightarrow \\ \leftarrow v_{3,1} \rightarrow \\ \leftarrow v_{4,1} \rightarrow \end{bmatrix}_{4 \times 64} $$

#### 3. 计算注意力分数 (Scaled Dot-Product Attention)
**第一步：算 Q 和 K 的内积。** 代表每个词和句子中其他词的相关性。
维度转换：`[4, 64] @ [64, 4]` (K的转置) $\rightarrow$ `[4, 4]`

$$ Score_1 = Q_1 \times K_1^T = \begin{bmatrix}
q_1 \cdot k_1 & q_1 \cdot k_2 & q_1 \cdot k_3 & q_1 \cdot k_4 \\
q_2 \cdot k_1 & q_2 \cdot k_2 & q_2 \cdot k_3 & q_2 \cdot k_4 \\
q_3 \cdot k_1 & q_3 \cdot k_2 & q_3 \cdot k_3 & q_3 \cdot k_4 \\
q_4 \cdot k_1 & q_4 \cdot k_2 & q_4 \cdot k_3 & q_4 \cdot k_4
\end{bmatrix}_{4 \times 4} $$
*(注：矩阵里的元素就是两个 64 维向量的内积，是一个标量数值)*

**第二步：缩放(Scale)与 Softmax。** 除以 $\sqrt{d_k} = \sqrt{64} = 8$，并按行做 Softmax，让每行加起来等于 1。
维度保持不变：`[4, 4]`

$$ AttentionWeights_1 = \text{Softmax}\left(\frac{Score_1}{8}\right) = \begin{bmatrix}
0.5 & 0.1 & 0.2 & 0.2 \\
0.1 & 0.7 & 0.1 & 0.1 \\
0.2 & 0.3 & 0.4 & 0.1 \\
0.0 & 0.1 & 0.1 & 0.8
\end{bmatrix}_{4 \times 4} $$
*(直观理解：第一行代表第一个词 "I"，它把 50% 的注意力放在自己身上，20%放在第3个词上...)*



**第三步：乘以 V 矩阵。** 用注意力分数对 Value 进行加权求和。
维度转换：`[4, 4] @ [4, 64]` $\rightarrow$ `[4, 64]`

$$ Z_1 = AttentionWeights_1 \times V_1 = \begin{bmatrix}
\leftarrow z_{1,1} \text{ (融合了上下文的词1表示)} \rightarrow \\
\leftarrow z_{2,1} \text{ (融合了上下文的词2表示)} \rightarrow \\
\leftarrow z_{3,1} \text{ (融合了上下文的词3表示)} \rightarrow \\
\leftarrow z_{4,1} \text{ (融合了上下文的词4表示)} \rightarrow 
\end{bmatrix}_{4 \times 64} $$

#### 4. 多头拼接与线性映射 (Concat & Output Linear)
现在 8 个头都算完了，我们得到 $Z_1, Z_2, ..., Z_8$，每个维度都是 `[4, 64]`。
把它们在特征维度拼接起来：
维度转换：`8 个 [4, 64]` $\rightarrow$ Concat $\rightarrow$ `[4, 512]`

$$ Z_{concat} = \begin{bmatrix} 
\leftarrow z_{1,1} \rightarrow & \leftarrow z_{1,2} \rightarrow & \cdots & \leftarrow z_{1,8} \rightarrow \\
\leftarrow z_{2,1} \rightarrow & \leftarrow z_{2,2} \rightarrow & \cdots & \leftarrow z_{2,8} \rightarrow \\
\vdots & \vdots & \ddots & \vdots \\
\leftarrow z_{4,1} \rightarrow & \leftarrow z_{4,2} \rightarrow & \cdots & \leftarrow z_{4,8} \rightarrow 
\end{bmatrix}_{4 \times 512} $$

最后乘以一个输出权重矩阵 $W^O$ (`[512, 512]`)，整合多头信息。
$Z_{final} = Z_{concat} \times W^O$ ，最终结果维度依然是 **`[4, 512]`**。
#### 5. Add & Norm (残差连接与层归一化)

每一个子层（Multi-Head Attention 或 FFN）后面都紧跟一次 **Add & Norm**。论文采用 Post-LN 方式：先加残差，再做层归一化。

> [!note]- 在做 Add 之前，子层输出 $X_{sub}$ 会先经过 **Dropout**（$P=0.1$），残差通路本身不受影响，详见 [[#4. Dropout 正则化|Dropout 正则化]]

**第一步：Add (残差连接)。** 把子层的输入 $X_{in}$ 和 Dropout 后的子层输出 $X_{sub}$ 逐元素相加。
维度转换：`[4, 512] + [4, 512]` $\rightarrow$ `[4, 512]`

$$ X_{add} = X_{in} + X_{sub} = \begin{bmatrix}
\leftarrow x_1 + z_{final,1} \rightarrow \\
\leftarrow x_2 + z_{final,2} \rightarrow \\
\leftarrow x_3 + z_{final,3} \rightarrow \\
\leftarrow x_4 + z_{final,4} \rightarrow
\end{bmatrix}_{4 \times 512} $$

*(直观理解：残差连接好比给梯度修了一条"高速公路"。哪怕注意力层或 FFN 的梯度消失了，信号也能通过这条短路直达底层。**这就是 Transformer 敢堆 N=6、12、甚至 96 层的底气。**)*

**第二步：Norm (层归一化，Layer Normalization)。** 对矩阵的**每一行**（每个 token 的 512 维向量）独立归一化，稳定训练。

对于第 $i$ 行向量 $r_i = [r_{i,1}, r_{i,2}, ..., r_{i,512}]$，LayerNorm 的完整流程：

1. **求均值**：$\mu_i = \frac{1}{512}\sum_{j=1}^{512} r_{i,j}$
2. **求方差**：$\sigma_i^2 = \frac{1}{512}\sum_{j=1}^{512} (r_{i,j} - \mu_i)^2$
3. **标准化**：$\hat{r}_{i,j} = \dfrac{r_{i,j} - \mu_i}{\sqrt{\sigma_i^2 + \epsilon}} \quad$（$\epsilon = 10^{-5}$，防止除零）
4. **可学习的缩放与平移**：$y_{i,j} = \gamma_j \cdot \hat{r}_{i,j} + \beta_j \quad$（$\gamma, \beta$ 各为长度 512 的向量，随训练学习）

维度始终保持：`[4, 512]` $\rightarrow$ `[4, 512]`

$$ X_{norm} = \text{LayerNorm}(X_{add}) = \begin{bmatrix}
\leftarrow \text{LN(token}_1\text{): 均值归一化 + }\gamma\beta\text{ 缩放平移} \rightarrow \\
\leftarrow \text{LN(token}_2\text{): 均值归一化 + }\gamma\beta\text{ 缩放平移} \rightarrow \\
\leftarrow \text{LN(token}_3\text{): 均值归一化 + }\gamma\beta\text{ 缩放平移} \rightarrow \\
\leftarrow \text{LN(token}_4\text{): 均值归一化 + }\gamma\beta\text{ 缩放平移} \rightarrow
\end{bmatrix}_{4 \times 512} $$

**LayerNorm vs BatchNorm —— 为什么 Transformer 不用 BatchNorm？**

| | BatchNorm | LayerNorm (Transformer 的选择) |
|---|---|---|
| **归一化方向** | 对**每一列**（所有 token 的同一特征维度） | 对**每一行**（每个 token 的所有特征） |
| **归一化对象** | `[Batch, L, 512]` → 沿 Batch × L 方向 | `[4, 512]` → 沿 512 方向 |
| **依赖关系** | 依赖 batch 内其他样本 | **完全独立**，每个 token 各算各的 |
| **序列建模的痛点** | 序列长度可变 → 统计量不稳定；推理时没有 batch → 需额外处理 | 序列长度随便变，train/test 行为完全一致 |

*(一句话总结：LayerNorm 让每个 token "管好自己"，不依赖别人，天然适合变长序列。)*

最终 Add & Norm 的输出 $X_{norm}$ 维度 **`[4, 512]`**，随即送入 Feed-Forward Network。

#### 6. 前馈神经网络 (Feed-Forward Network)

论文中的公式（Position-wise Feed-Forward Network）：

$$\text{FFN}(x) = \max(0, \, xW_1 + b_1) \, W_2 + b_2$$

其中 $\max(0, \cdot)$ 即 ReLU 激活，$W_1$ 的维度为 $d_{model} \times d_{ff} = 512 \times 2048$，$W_2$ 的维度为 $d_{ff} \times d_{model} = 2048 \times 512$。两个线性变换夹一个激活函数——先升维再降维。这是 Transformer 中**参数量最大的部分**（约占整个 Encoder 的 2/3）。

**第一层 (升维)：** 将输入 $X_{norm}$（Add & Norm 的输出）乘以权重矩阵 $W_1$。$W_1$ 把每个 token 从 512 维"撑开"到 2048 维，让模型在更高维度空间做非线性变换。

$$ W_1 = \begin{bmatrix}
w_{1,1} & w_{1,2} & \cdots & w_{1,2048} \\
w_{2,1} & w_{2,2} & \cdots & w_{2,2048} \\
\vdots & \vdots & \ddots & \vdots \\
w_{512,1} & w_{512,2} & \cdots & w_{512,2048}
\end{bmatrix}_{512 \times 2048} $$

维度转换：`[4, 512] @ [512, 2048]` $\rightarrow$ `[4, 2048]`

先看线性变换的原始输出 $H = X_{norm} \times W_1 + b_1$。此时矩阵里有正有负，维度 `[4, 2048]`（只展示每行的前 8 个元素示意）：

$$ H = \begin{bmatrix}
-0.3 & 1.5 & 0.0 & -2.1 & 0.8 & -0.7 & 3.2 & -1.0 & \cdots \\
0.6 & -0.2 & 1.1 & -3.0 & 0.0 & 2.4 & -1.5 & -0.8 & \cdots \\
-1.2 & 0.9 & -0.4 & 0.3 & -2.6 & 1.7 & -0.1 & 0.5 & \cdots \\
2.1 & -0.9 & -1.8 & 0.7 & 0.2 & -0.6 & 0.4 & -2.3 & \cdots
\end{bmatrix}_{4 \times 2048} $$

然后逐元素施加 ReLU：$\text{ReLU}(x) = \max(0, x)$。**负数全部归零，正数原样保留，零不变。**

$$ FF_1 = \text{ReLU}(H) = \begin{bmatrix}
0.0 & 1.5 & 0.0 & 0.0 & 0.8 & 0.0 & 3.2 & 0.0 & \cdots \\
0.6 & 0.0 & 1.1 & 0.0 & 0.0 & 2.4 & 0.0 & 0.0 & \cdots \\
0.0 & 0.9 & 0.0 & 0.3 & 0.0 & 1.7 & 0.0 & 0.5 & \cdots \\
2.1 & 0.0 & 0.0 & 0.7 & 0.2 & 0.0 & 0.4 & 0.0 & \cdots
\end{bmatrix}_{4 \times 2048} $$

*(直观理解有三层：① **引入非线性**——没有 ReLU，两层线性变换等价于一层（$W_1 W_2$ 还是线性），模型就只能拟合线性函数；② **稀疏激活**——大约一半的神经元被置零，每次只有部分特征通路被激活，类似"选择性关注"某些高维特征模式；③ **梯度友好**——正数区域梯度恒为 1，缓解了 Sigmoid/Tanh 的梯度消失问题。整个 "expand → ReLU → compress" 的设计，$2048 / 512 = 4$ 倍扩展率，是论文精心调出来的超参数。)*

**第二层 (降维)：** 将 $FF_1$ 乘以权重矩阵 $W_2$。$W_2$ 把特征从 2048 维压回 512 维，恢复为下一层需要的标准维度。

$$ W_2 = \begin{bmatrix}
w_{1,1} & w_{1,2} & \cdots & w_{1,512} \\
w_{2,1} & w_{2,2} & \cdots & w_{2,512} \\
\vdots & \vdots & \ddots & \vdots \\
w_{2048,1} & w_{2048,2} & \cdots & w_{2048,512}
\end{bmatrix}_{2048 \times 512} $$

维度转换：`[4, 2048] @ [2048, 512]` $\rightarrow$ **`[4, 512]`**

$$ FF_{out} = FF_1 \times W_2 + b_2 = \begin{bmatrix}
\leftarrow & \text{降维后的 token}_1 \text{ 表示 (长度 512)} & \rightarrow \\
\leftarrow & \text{降维后的 token}_2 \text{ 表示 (长度 512)} & \rightarrow \\
\leftarrow & \text{降维后的 token}_3 \text{ 表示 (长度 512)} & \rightarrow \\
\leftarrow & \text{降维后的 token}_4 \text{ 表示 (长度 512)} & \rightarrow 
\end{bmatrix}_{4 \times 512} $$

**FFN 参数量速算：**
- $W_1$: $512 \times 2048 = 1,048,576$
- $b_1$: $2048$
- $W_2$: $2048 \times 512 = 1,048,576$
- $b_2$: $512$
- **单层 FFN 合计：约 210 万参数**（对比 MHA 的 4 个 `[512, 512]` 权重矩阵合计约 105 万，FFN 参数量几乎是 MHA 的 **2 倍**）

*(随后再次 Add & Norm，操作与上面第 5 节完全一致。Encoder 的最终输出矩阵 $M_{enc}$ 维度锁定为 `[4, 512]`)*

---

### 第三阶段：解码器特有结构 (Decoder Specifics)

Decoder 的结构大多和 Encoder 相同，但我挑出**两个最容易产生疑惑的地方**重点拆解：

#### 特例 1：带掩码的多头自注意力 (Masked Self-Attention)
假设 Decoder 当前处理 3 个词。输入计算后，拿到 $Q_{dec}$ 和 $K_{dec}$，维度都是 `[3, 64]`（单头）。
算内积时：`[3, 64] @ [64, 3]` $\rightarrow$ `[3, 3]`
为了防止“看到未来”，要在 Softmax 之前加上 Mask（将右上角变为 $-\infty$）：

$$ MaskedScore = \begin{bmatrix}
q_1 \cdot k_1 & -\infty & -\infty \\
q_2 \cdot k_1 & q_2 \cdot k_2 & -\infty \\
q_3 \cdot k_1 & q_3 \cdot k_2 & q_3 \cdot k_3
\end{bmatrix}_{3 \times 3} \xrightarrow{\text{Softmax}} \begin{bmatrix}
1.0 & 0.0 & 0.0 \\
0.6 & 0.4 & 0.0 \\
0.3 & 0.5 & 0.2
\end{bmatrix}_{3 \times 3} $$
这样，词2（第二行）就只能分配注意力给词1和词2，永远无法把权重分给词3（权重为0）。

#### 特例 2：编码器-解码器交叉注意力 (Cross-Attention)
这是整个 Transformer 连接两端的桥梁！这里的维度变换最奇妙：
*   **Query (Q)** 来自 Decoder 层自己的上一层输出。假设序列长度是 3，所以 $Q$ 维度是 **`[3, 64]`** (单头)。
*   **Key (K) 和 Value (V)** 来自 Encoder 的最终输出 $M_{enc}$。Encoder 的序列长度是 4，所以 $K$ 和 $V$ 维度是 **`[4, 64]`** (单头)。

**计算 Attention Score：** Decoder 的 3 个词，去查询 Encoder 的 4 个词。
维度转换：`[3, 64]` (Q) `@` `[64, 4]` (K的转置) $\rightarrow$ **`[3, 4]`**

$$ CrossScore = Q_{dec} \times K_{enc}^T = \begin{bmatrix}
q^{dec}_1 \cdot k^{enc}_1 & q^{dec}_1 \cdot k^{enc}_2 & q^{dec}_1 \cdot k^{enc}_3 & q^{dec}_1 \cdot k^{enc}_4 \\
q^{dec}_2 \cdot k^{enc}_1 & q^{dec}_2 \cdot k^{enc}_2 & q^{dec}_2 \cdot k^{enc}_3 & q^{dec}_2 \cdot k^{enc}_4 \\
q^{dec}_3 \cdot k^{enc}_1 & q^{dec}_3 \cdot k^{enc}_2 & q^{dec}_3 \cdot k^{enc}_3 & q^{dec}_3 \cdot k^{enc}_4
\end{bmatrix}_{3 \times 4} $$
*(直观理解：这个 `3x4` 矩阵表示 Decoder 中的 3 个词，分别对 Encoder 原句中 4 个词的关注程度)*

然后对 CrossScore 做同样的缩放和 Softmax（除以 $\sqrt{d_k} = 8$，按行归一化），得到交叉注意力权重矩阵：
维度保持不变：`[3, 4]`

$$ CrossWeights = \text{Softmax}\left(\frac{CrossScore}{8}\right) = \begin{bmatrix}
0.4 & 0.3 & 0.2 & 0.1 \\
0.1 & 0.5 & 0.3 & 0.1 \\
0.2 & 0.2 & 0.1 & 0.5
\end{bmatrix}_{3 \times 4} $$
*(直观理解：第一行表示 Decoder 的第 1 个词，把 40% 注意力放在 Encoder 第 1 个词上、30% 放第 2 个词上……)*

**乘以 Value：** 用交叉注意力权重对 Encoder 的 Value 做加权求和。

$$ V_{enc} = \begin{bmatrix}
\leftarrow v^{enc}_1 \text{ (长度64)} \rightarrow \\
\leftarrow v^{enc}_2 \text{ (长度64)} \rightarrow \\
\leftarrow v^{enc}_3 \text{ (长度64)} \rightarrow \\
\leftarrow v^{enc}_4 \text{ (长度64)} \rightarrow
\end{bmatrix}_{4 \times 64} $$

维度转换：`[3, 4]` (Weights) `@` `[4, 64]` ($V_{enc}$) $\rightarrow$ **`[3, 64]`**

$$ Z_{cross} = CrossWeights \times V_{enc} = \begin{bmatrix}
\leftarrow 0.4v^{enc}_1 + 0.3v^{enc}_2 + 0.2v^{enc}_3 + 0.1v^{enc}_4 \rightarrow \\
\leftarrow 0.1v^{enc}_1 + 0.5v^{enc}_2 + 0.3v^{enc}_3 + 0.1v^{enc}_4 \rightarrow \\
\leftarrow 0.2v^{enc}_1 + 0.2v^{enc}_2 + 0.1v^{enc}_3 + 0.5v^{enc}_4 \rightarrow
\end{bmatrix}_{3 \times 64} $$

*(直观理解：$Z_{cross}$ 的每一行是 Encoder 4 个位置 Value 向量的加权和，权重来自 CrossWeights。Decoder 长度为 3 的 Query，从 Encoder 长度为 4 的 Value 中”提纯”出了自己想要的 3 行信息。)*

**8 个头合并与线性映射：** 现在 8 个头都算完了，我们得到 $Z_{cross,1}, Z_{cross,2}, ..., Z_{cross,8}$，每个维度都是 `[3, 64]`。沿特征维度拼接：
维度转换：`8 个 [3, 64]` $\rightarrow$ Concat $\rightarrow$ `[3, 512]`

$$ Z^{cross}_{concat} = \begin{bmatrix} 
\leftarrow z^{cross}_{1,1} \rightarrow & \leftarrow z^{cross}_{1,2} \rightarrow & \cdots & \leftarrow z^{cross}_{1,8} \rightarrow \\
\leftarrow z^{cross}_{2,1} \rightarrow & \leftarrow z^{cross}_{2,2} \rightarrow & \cdots & \leftarrow z^{cross}_{2,8} \rightarrow \\
\leftarrow z^{cross}_{3,1} \rightarrow & \leftarrow z^{cross}_{3,2} \rightarrow & \cdots & \leftarrow z^{cross}_{3,8} \rightarrow 
\end{bmatrix}_{3 \times 512} $$

最后乘以输出权重矩阵 $W^O$ (`[512, 512]`)，整合多头信息。
$Z^{cross}_{final} = Z^{cross}_{concat} \times W^O$，维度 **`[3, 512]`**。
*(随后同样经过 Add & Norm，得到 $Out_{dec}$，然后送入下一层 Decoder 或 FFN。)*

#### 特例 3：KV Cache —— 推理时避免重复计算

训练时一次性输入 $M = 3$ 个 token，Self-Attention 并行算 $QK^T \in \mathbb{R}^{3 \times 3}$。
推理时逐 token 生成，每步只多一个 token，但朴素做法会重算所有历史 token 的 $K, V$。
KV Cache 的做法：**算过的 $K, V$ 存起来，每步只算新 token 的 $k, v$ 并拼入缓存。**

**Step 1**：输入 `[BOS]`，预测 `"我"`
维度转换：`[1, 64]`（单头）

$$
K^{(1)} = \begin{bmatrix} \leftarrow k_{\text{BOS}} \rightarrow \end{bmatrix}_{1 \times 64}
\qquad
V^{(1)} = \begin{bmatrix} \leftarrow v_{\text{BOS}} \rightarrow \end{bmatrix}_{1 \times 64}
$$

$$
Q^{(1)} K^{(1)T} \;\in\; \mathbb{R}^{1 \times 1}
\quad\rightarrow\quad
Z^{(1)} \;\in\; \mathbb{R}^{1 \times 64}
$$

**Step 2**：输入 `[BOS, 我]`，预测 `"爱"`
只算新 token `"我"` 的 $k, v \in \mathbb{R}^{1 \times 64}$，拼入缓存：

$$
K_{\text{cache}} = \begin{bmatrix} \leftarrow k_{\text{BOS}} \rightarrow \\ \leftarrow k_{\text{我}} \rightarrow \end{bmatrix}_{2 \times 64}
\qquad
V_{\text{cache}} = \begin{bmatrix} \leftarrow v_{\text{BOS}} \rightarrow \\ \leftarrow v_{\text{我}} \rightarrow \end{bmatrix}_{2 \times 64}
$$

维度转换：$Q_{\text{新}} \in \mathbb{R}^{1 \times 64} \;\times\; K_{\text{cache}}^T \in \mathbb{R}^{64 \times 2} \;\rightarrow\; \mathbb{R}^{1 \times 2}$

$$
Score = Q_{\text{我}} \times K_{\text{cache}}^T
= \begin{bmatrix} q_{\text{我}} \!\cdot\! k_{\text{BOS}} & q_{\text{我}} \!\cdot\! k_{\text{我}} \end{bmatrix}_{1 \times 2}
$$

$$
\xrightarrow{\text{Softmax}} \begin{bmatrix} w_1 & w_2 \end{bmatrix}_{1 \times 2}
\quad\longrightarrow\quad
Z = \begin{bmatrix} w_1 & w_2 \end{bmatrix} V_{\text{cache}}
= \begin{bmatrix} \leftarrow w_1 v_{\text{BOS}} + w_2 v_{\text{我}} \rightarrow \end{bmatrix}_{1 \times 64}
$$

*(不用 cache：重算全部 `[2, 64]` 的 $K, V$，其中 `[BOS]` 行与 Step 1 重复。)*


**Step 3**：输入 `[BOS, 我, 爱]`，预测 `"机器"`
只算新 token `"爱"` 的行，拼入缓存：

$$
K_{\text{cache}} = \begin{bmatrix} \leftarrow k_{\text{BOS}} \rightarrow \\ \leftarrow k_{\text{我}} \rightarrow \\ \leftarrow k_{\text{爱}} \rightarrow \end{bmatrix}_{3 \times 64}
\qquad
V_{\text{cache}} = \begin{bmatrix} \leftarrow v_{\text{BOS}} \rightarrow \\ \leftarrow v_{\text{我}} \rightarrow \\ \leftarrow v_{\text{爱}} \rightarrow \end{bmatrix}_{3 \times 64}
$$

维度转换：`[1, 64] @ [64, 3]` $\rightarrow$ `[1, 3]` $\rightarrow$ `[1, 64]`


**Step $t$ 的一般形式：**

$$
K_{\text{cache}}^{(t)} = \begin{bmatrix} K_{\text{cache}}^{(t-1)} \\ \leftarrow k_t \rightarrow \end{bmatrix}_{t \times 64}
\qquad
V_{\text{cache}}^{(t)} = \begin{bmatrix} V_{\text{cache}}^{(t-1)} \\ \leftarrow v_t \rightarrow \end{bmatrix}_{t \times 64}
$$

$$
\text{Attention}^{(t)} = \text{Softmax}\!\left( \frac{Q_t \cdot K_{\text{cache}}^{(t)T}}{\sqrt{d_k}} + Mask \right) \cdot V_{\text{cache}}^{(t)}
$$

| | 不用 KV Cache | 用 KV Cache |
|---|---|---|
| Step $t$ 的 $K, V$ | 算 $t$ 行 | **算 1 行**（新 token） |
| Step $t$ 的 $QK^T$ | $[t \times t]$ | **$[1 \times t]$** |
| 总复杂度（$L$ 步） | $\sum_{t=1}^{L} O(t^2) \approx O(L^3)$ | $\sum_{t=1}^{L} O(t) \approx O(L^2)$ |

*(每一层 Decoder 独立维护一组缓存。Cross-Attention 的 $K, V$ 来自 Encoder 一次前向，天然不变。)*

---

### 第四阶段：输出映射 (Output Linear & Softmax)

Decoder 处理完 $N=6$ 层后，最终输出矩阵 $Out_{dec}$，维度是 **`[3, 512]`**。

最后，通过一个巨大的全连接层映射到词表空间（假设词表大小 $V=30000$）。权重矩阵 $W_{vocab}$ 把每个 token 的 512 维表示，投影为 30000 个"候选词得分"。

$$ W_{vocab} = \begin{bmatrix}
w_{1,1} & w_{1,2} & \cdots & w_{1,30000} \\
w_{2,1} & w_{2,2} & \cdots & w_{2,30000} \\
\vdots & \vdots & \ddots & \vdots \\
w_{512,1} & w_{512,2} & \cdots & w_{512,30000}
\end{bmatrix}_{512 \times 30000} $$

维度转换：`[3, 512] @ [512, 30000]` $\rightarrow$ **`[3, 30000]`**

$$ Logits = Out_{dec} \times W_{vocab} = \begin{bmatrix}
l_{1,1} & l_{1,2} & \cdots & l_{1,30000} \\
l_{2,1} & l_{2,2} & \cdots & l_{2,30000} \\
l_{3,1} & l_{3,2} & \cdots & l_{3,30000} 
\end{bmatrix}_{3 \times 30000} $$

*(注：Logits 里的每个数值 $l_{i,j}$ 代表"Decoder 第 $i$ 个位置预测下一个词是词表中第 $j$ 号词的原始得分"，可正可负，数值越大越可能。)*

**Softmax 转换为概率：** 对每一行独立做 Softmax，把 30000 个原始得分压缩为 30000 个概率值（每行加起来等于 1）。

$$\text{Softmax}(l_{i,j}) = \frac{e^{l_{i,j}}}{\sum_{k=1}^{30000} e^{l_{i,k}}}$$

维度保持不变：`[3, 30000]`

$$ Probs = \text{Softmax}(Logits) = \begin{bmatrix}
0.01 & \overbrace{0.35}^{\text{第2号词!}} & 0.00 & 0.12 & \cdots & 0.00 \\
0.00 & 0.02 & 0.00 & 0.00 & \cdots & \overbrace{0.58}^{\text{第29999号词!}} \\
0.03 & 0.00 & \overbrace{0.41}^{\text{第3号词!}} & 0.07 & \cdots & 0.01
\end{bmatrix}_{3 \times 30000} $$

**训练 vs 推理——用哪一行？** 这是最容易混淆的地方，必须区分两种场景：

| | 训练 (Teacher Forcing) | 推理 (自回归生成) |
|---|---|---|
| **做法** | 3 行全部参与 loss 计算 | 只取最后一行（第 3 行） |
| **含义** | 位置 1 预测 Token₂、位置 2 预测 Token₃、位置 3 预测 Token₄——和"右移一位"的标准答案比对 | 我们已有 "我 爱 机器" 三个词，只需知道第 4 个词是什么 |
| **下一步** | 一次性算出整条句子的梯度 | 取第 3 行 argmax 得到 Token₄，把它拼到输入后面变成 "我 爱 机器 X"，再跑一次 Decoder，取新的最后一行预测 Token₅……循环直到 `<eos>` |

所以推理时，我们真正用的是 Probs 矩阵的**最后一行**：

$$ \text{Probs}_{\text{最后一行}} = \begin{bmatrix}
0.03 & 0.00 & \overbrace{0.41}^{\text{Token}_3\text{!}} & 0.07 & \cdots & 0.01
\end{bmatrix}_{1 \times 30000} $$

$$ \downarrow \text{argmax（取最大值所在的列号）} $$

$$ \text{下一词} = \text{Token}_3 \quad (\text{概率 } 41\%) $$

*(argmax vs max：max 返回值 0.41，argmax 返回 0.41 所在的**列号**——即词表中第 3 号词的 ID。我们关心的不是概率值本身，而是"哪个词"的概率最大。)*

*(直观理解：Decoder 看了 "我 爱 机器" 三个词后，认为接下来最可能是词表中第 3 号词。拿到这个词后，把它追加到输入序列变成 4 个词，再跑一轮 Decoder，此时 Probs 变成 `[4, 30000]`，取最后一行继续预测……如此往复，直到模型预测出 `<eos>`（End of Sequence，句子结束符——词表中一个特殊的 Token，表示"这句话到此为止"），生成过程自动停止。)*

**补充：权重共享 (Weight Tying)。** 很多实现中，$W_{vocab}$ 直接复用词嵌入矩阵 $W_{emb}$ 的转置（即 `[30000, 512]` 的转置 = `[512, 30000]`）。这样不仅节省参数量（少存一份 30000×512 ≈ 1536 万参数的矩阵），还有语义上的好处：一个词的"输入表示"和"输出预测"共享同一个向量空间。

---

### 第五阶段：训练配置 (Training Details)

前四阶段讲完了 Transformer 的正向传播，但要让它真正学会翻译，还需要以下关键训练设置（全部来自原论文）。

#### 1. 优化器：Adam

论文使用 Adam 优化器。对于第 $t$ 步的梯度 $g_t$，Adam 的完整更新流程如下：

**Step 1：计算有偏一阶矩和二阶矩估计**

$$m_t = \beta_1 \cdot m_{t-1} + (1 - \beta_1) \cdot g_t$$
$$v_t = \beta_2 \cdot v_{t-1} + (1 - \beta_2) \cdot g_t^2$$
可以把它们理解为：
- $m_t$​：最近一段时间，梯度平均朝哪个方向
- $v_t$​：最近一段时间，梯度大小有多剧烈
- $\hat m_t/\sqrt{\hat v_t}$ ：Adam 最终决定的“标准化更新方向”
*(注：$g_t^2$ 表示逐元素平方。$m_t$ 跟踪梯度的均值（动量），$v_t$ 跟踪梯度的方差（自适应缩放）。)*

**Step 2：偏差校正 (Bias Correction)**

由于 $m_0 = 0$ 且 $v_0 = 0$，初期的 $m_t$ 和 $v_t$ 会偏小。除以 $(1 - \beta^t)$ 来修正：

$$\hat{m}_t = \frac{m_t}{1 - \beta_1^t}$$
$$\hat{v}_t = \frac{v_t}{1 - \beta_2^t}$$

> [!note]- 推导过程详见 [[Adam|Adam 偏差修正推导]]

**Step 3：参数更新**

$$\theta_t = \theta_{t-1} - lrate \cdot \frac{\hat{m}_t}{\sqrt{\hat{v}_t} + \epsilon}$$

论文使用的参数值：

| 参数 | 值 | 含义 |
|---|---|---|
| $\beta_1$ | 0.9 | 一阶矩衰减率（动量项，控制过去梯度的影响范围） |
| $\beta_2$ | 0.98 | 二阶矩衰减率（自适应学习率，控制每个参数的步长缩放） |
| $\epsilon$ | $10^{-9}$ | 防止 $\sqrt{\hat{v}_t}$ 为 0 时除零 |

> 注意：$\beta_2 = 0.98$ 而非 Adam 默认的 0.999，这是论文针对序列建模任务专门调的——更低的 $\beta_2$ 让二阶矩估计 $v_t$ 衰减更快，模型对近期梯度更敏感，能更快适应训练过程中的剧烈变化。

#### 2. 学习率调度 (Learning Rate Schedule)

论文没有用固定学习率，而是设计了 **warmup + 逆平方根衰减** 的动态策略：

$$lrate = d_{model}^{-0.5} \cdot \min\left( step\_num^{-0.5},\; step\_num \cdot warmup\_steps^{-1.5} \right)$$

其中 $d_{model} = 512$，$warmup\_steps = 4000$。

代入常量后简化为：

$$lrate = \frac{1}{\sqrt{512}} \cdot \min\left( \frac{1}{\sqrt{step\_num}},\; \frac{step\_num}{4000^{1.5}} \right)$$

这个公式分两个阶段：

| 阶段         | 步数范围          | 公式                                   | 行为                                                           |
| ---------- | ------------- | ------------------------------------ | ------------------------------------------------------------ |
| **Warmup** | $1 \sim 4000$ | $lrate \propto step\_num$            | 学习率**线性增长**，从 0 慢慢爬升，避免训练初期梯度不稳定导致震荡（训练初期Adam 刚开始还没有稳定的历史统计） |
| **衰减**     | $> 4000$      | $lrate \propto 1 / \sqrt{step\_num}$ | 学习率**逐步下降**，训练后期步子越来越小，精细收敛                                  |

以 $d_{model}=512$ 为例，峰值出现在第 4000 步：
$$lrate_{max} = \frac{1}{\sqrt{512}} \cdot \frac{4000}{4000^{1.5}} \approx 0.044 \cdot 0.0158 \approx 7.0 \times 10^{-4}$$

#### 3. 标签平滑 (Label Smoothing)

训练时，标准答案不是严格的 one-hot 向量（正确答案为 1，其他全 0），而是做了"软化"处理。论文设 $\epsilon_{ls} = 0.1$：

**Label Smoothing 前（one-hot）：**
$$y_{one\text{-}hot} = [0, 0, 0, 1, 0, ..., 0] \quad \text{(正确答案在第 4 号位置)}$$

**Label Smoothing 后（软化）：**
$$y_{smoothed} = \left[ \frac{0.1}{29999}, \frac{0.1}{29999}, \frac{0.1}{29999}, 0.9, \frac{0.1}{29999}, ..., \frac{0.1}{29999} \right]$$

| 位置 | 原始 one-hot | 平滑后 |
|---|---|---|
| 正确词（第 4 号） | 1.0 | **0.9** |
| 其余 29999 个词 | 0.0 | **0.1 / 29999 ≈ 3.3 × 10⁻⁶** 每个 |

*(直观理解：不告诉模型"答案 100% 是这个词"，而是说"90% 是这个词，剩下 10% 平均分给其他所有词"。这防止模型过度自信，提升泛化能力——论文实验显示 label smoothing 能让 BLEU 分数提升约 0.5 ∼ 1 分，但也会让模型输出的概率分布更"扁平"，困惑度 (perplexity) 反而变差。)*

#### 4. Dropout 正则化

论文设置 $P_{drop} = 0.1$，即随机丢弃 10% 的神经元。

##### 作用位置

Dropout 在 Transformer 中有 **三个** 施加点：

| 施加位置                 | 具体说明                                                                        |
| -------------------- | --------------------------------------------------------------------------- |
| ① **词嵌入 + 位置编码之后**   | 对 $X = X_{emb} + PE$ 做 dropout，再做后续计算                                       |
| ② **每个子层输出（Add 之前）** | 对 Multi-Head Attention 和 FFN 的输出 $X_{sub}$ 做 dropout，再加残差                   |
| ③ **注意力权重上**         | 论文在 softmax 之后、乘以 $V$ 之前也对 attention weights 做了 dropout（部分实现遵循，部分省略）（论文里没写） |

##### 原理

训练时，每个神经元以概率 $P_{drop}$ 被"丢弃"（输出置零），存活下来的神经元输出乘以 $\frac{1}{1 - P_{drop}}$ 进行缩放，保证整体输出的期望值不变。

以位置 ②（子层输出）为例，设 $X_{sub}$ 是子层计算结果（`[4, 512]`）：

$$X_{drop} = \text{Dropout}(X_{sub}) = \begin{bmatrix}
\color{red}{0} & 1.11x_{1,2} & x_{1,3} & \color{red}{0} & \cdots & 1.11x_{1,512} \\
1.11x_{2,1} & x_{2,2} & \color{red}{0} & \color{red}{0} & \cdots & x_{2,512} \\
x_{3,1} & \color{red}{0} & 1.11x_{3,3} & x_{3,4} & \cdots & \color{red}{0} \\
\color{red}{0} & x_{4,2} & \color{red}{0} & 1.11x_{4,4} & \cdots & x_{4,512}
\end{bmatrix}_{4 \times 512}$$

被丢弃的位置（标红）直接置零，其余位置的数值放大 $1 / (1 - 0.1) = 1.11$ 倍。维度始终不变：`[4, 512]`。

随后才做残差连接（Add）和层归一化（Norm）：

$$X_{out} = \text{LayerNorm}(X_{in} + X_{drop})$$

##### 为什么是 Add 之前而非之后？

如果在 Add 之后做 dropout，残差路径上的一部分信号会随机消失，相当于把"高速公路"也给封了一部分——破坏了残差连接保护梯度流动的初衷。**Add 之前**做 dropout，残差通路始终完整，dropout 只作用在子层自身的输出上。

##### 训练 vs 推理

| 阶段     | Dropout 行为                                        |
| ------ | ------------------------------------------------- |
| **训练** | 随机丢弃 + 缩放，每次前向传播的丢弃模式都不同（相当于隐式集成了指数级数量的子网络）       |
| **推理** | **Dropout 完全关闭**，所有神经元正常输出，不做任何缩放（因为缩放已在训练中"预支"了） |

*(直观理解：训练时 dropout 强迫每个神经元学会"独立工作"——万一旁边的神经元被丢弃了，自己也得能顶上。这让模型不会过度依赖某些特定神经元组合，泛化能力更强。)*

##### 其他

| 技术      | 论文设置              | 说明                                          |
| ------- | ----------------- | ------------------------------------------- |
| **参数量** | Base 模型约 6500 万参数 | （6 层 Encoder + 6 层 Decoder，$d_{model}=512$） |

---
