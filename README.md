# qingtu-taro（轻图）

[Taro 4](https://docs.taro.zone/) + React + TypeScript，对齐 [qingtu-flutter](https://github.com/swqztech/qingtu-flutter)。

## 运行

```bash
pnpm install
pnpm dev:h5
pnpm dev:weapp
```

## 功能

- 多图选择、质量调节、压缩（`Taro.compressImage`，以微信小程序端效果为准）
- 横向拼接（Canvas 2D）→ PNG，可保存到相册
- H5 端压缩为提示模式，完整能力建议在小程序/App 端使用
