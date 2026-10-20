import { Canvas, ScrollView, Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useState } from 'react';

import type { OutputFormat } from '../../models/OutputFormat';
import {
  compressOne,
  formatCompressLog,
  stitchHorizontal,
  type PickedImage,
} from '../../services/imageJobs';

import './index.scss';

const CANVAS_ID = 'stitchCanvas';

export default function Index() {
  const [compressTab, setCompressTab] = useState(true);
  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState<PickedImage[]>([]);
  const [quality, setQuality] = useState(80);
  const [format, setFormat] = useState<OutputFormat>('keep');
  const [log, setLog] = useState('');

  const pickFiles = async () => {
    try {
      const res = await Taro.chooseImage({
        count: 9,
        sizeType: ['original', 'compressed'],
        sourceType: ['album', 'camera'],
      });
      const added: PickedImage[] = res.tempFilePaths.map((path, i) => ({
        path,
        name: `image-${files.length + i + 1}.jpg`,
      }));
      setFiles(prev => [...prev, ...added]);
    } catch {
      /* 取消 */
    }
  };

  const saveToAlbum = async (path: string) => {
    try {
      await Taro.saveImageToPhotosAlbum({ filePath: path });
      Taro.showToast({ title: '已保存到相册', icon: 'success' });
    } catch {
      Taro.showModal({
        title: '轻图',
        content: '保存失败，请检查相册权限，或长按预览图保存。',
        showCancel: false,
      });
    }
  };

  const runJob = async () => {
    if (busy) {
      return;
    }
    if (!files.length) {
      setLog('请先添加图片');
      return;
    }
    setBusy(true);
    try {
      if (compressTab) {
        const lines = [];
        for (const f of files) {
          lines.push(await compressOne(f.path, quality, format));
        }
        setLog(formatCompressLog(lines));
        const last = lines.find(l => l.ok && l.outPath);
        if (last) {
          await saveToAlbum(last.outPath);
        }
      } else {
        if (files.length < 2) {
          setLog('拼接需要至少 2 张图');
          return;
        }
        const out = await stitchHorizontal(
          files.map(f => f.path),
          CANVAS_ID,
        );
        setLog(`拼接完成\n${out}`);
        await saveToAlbum(out);
      }
    } catch (e) {
      setLog(String(e));
    } finally {
      setBusy(false);
    }
  };

  const runLabel = compressTab
    ? `开始压缩 (${files.length})`
    : `开始拼接 (${files.length})`;

  return (
    <View className='page'>
      <Text className='title'>轻图</Text>
      <Text className='tagline'>把体积压下去，细节留住</Text>
      <Text className='hint'>本地处理 · PNG / JPG</Text>

      <View className='tabs'>
        <View
          className={`tab ${compressTab ? 'tab-active' : ''}`}
          onClick={() => setCompressTab(true)}>
          压缩
        </View>
        <View
          className={`tab ${!compressTab ? 'tab-active' : ''}`}
          onClick={() => setCompressTab(false)}>
          拼接
        </View>
      </View>

      <View className='card'>
        <Text style={{ color: files.length ? '#0d9488' : '#64748b' }}>
          {files.length ? `已选 ${files.length} 张` : '点击下方选择图片'}
        </Text>
        <View className='btn-orange' onClick={busy ? undefined : pickFiles}>
          选择图片
        </View>
      </View>

      <ScrollView scrollY className='file-list'>
        {files.map(f => (
          <View key={f.path}>{f.name}</View>
        ))}
      </ScrollView>

      {compressTab ? (
        <View className='panel'>
          <Text>质量：{quality}</Text>
          <View className='quality-row'>
            <Text onClick={() => setQuality(q => Math.max(1, q - 5))}>-</Text>
            <Text>{quality}</Text>
            <Text onClick={() => setQuality(q => Math.min(100, q + 5))}>+</Text>
          </View>
          <Text>输出格式</Text>
          <View className='chips'>
            {(
              [
                ['保持原格式', 'keep'],
                ['JPEG', 'jpeg'],
                ['PNG', 'png'],
              ] as const
            ).map(([label, val]) => (
              <View
                key={val}
                className={`chip ${format === val ? 'chip-active' : ''}`}
                onClick={() => setFormat(val)}>
                {label}
              </View>
            ))}
          </View>
        </View>
      ) : (
        <Text className='hint'>按列表顺序横向拼接，高度对齐最短边</Text>
      )}

      <View className='actions'>
        <View className='btn-orange' onClick={busy ? undefined : runJob}>
          {runLabel}
        </View>
        <View
          className='tab'
          onClick={() => {
            setFiles([]);
            setLog('');
          }}>
          清空
        </View>
      </View>

      <Text className='log'>{log}</Text>

      <Canvas
        type='2d'
        id={CANVAS_ID}
        canvasId={CANVAS_ID}
        className='hidden-canvas'
      />
    </View>
  );
}
