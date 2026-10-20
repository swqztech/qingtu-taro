import { Canvas, Text, View } from '@tarojs/components';
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
    if (busy) {
      return;
    }
    try {
      const res = await Taro.chooseImage({
        count: 9,
        sizeType: ['original', 'compressed'],
        sourceType: ['album', 'camera'],
      });
      const added: PickedImage[] = res.tempFilePaths.map((path, i) => ({
        path,
        name: `图片 ${files.length + i + 1}`,
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
        content: '保存失败，请检查相册权限。',
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

  const clearAll = () => {
    setFiles([]);
    setLog('');
  };

  const runLabel = compressTab
    ? `开始压缩 (${files.length})`
    : `开始拼接 (${files.length})`;

  return (
    <View className='page'>
      <View className='hero'>
        <Text className='brand'>轻图</Text>
        <Text className='tagline'>把体积压下去，细节留住</Text>
        <Text className='hint'>本地处理 · 不上传 · PNG / JPG</Text>
      </View>

      <View className='seg'>
        <View
          className={`seg-item ${compressTab ? 'seg-item-active' : ''}`}
          onClick={() => setCompressTab(true)}>
          <Text>压缩</Text>
        </View>
        <View
          className={`seg-item ${!compressTab ? 'seg-item-active' : ''}`}
          onClick={() => setCompressTab(false)}>
          <Text>拼接</Text>
        </View>
      </View>

      <View className='pick-card'>
        <Text
          className={`pick-status ${files.length ? 'pick-status-has' : ''}`}>
          {files.length ? `已选择 ${files.length} 张图片` : '从相册或相机添加图片'}
        </Text>
        <View
          className={`btn-orange ${busy ? 'btn-orange-disabled' : ''}`}
          onClick={pickFiles}>
          <Text>选择图片</Text>
        </View>
      </View>

      {files.length > 0 && (
        <View className='file-panel'>
          {files.map(f => (
            <View key={f.path} className='file-row'>
              <Text>{f.name}</Text>
            </View>
          ))}
        </View>
      )}

      {compressTab ? (
        <View className='settings'>
          <Text className='settings-title'>压缩质量</Text>
          <View className='quality-box'>
            <View
              className='step-btn'
              onClick={() => setQuality(q => Math.max(1, q - 5))}>
              <Text>-</Text>
            </View>
            <Text className='quality-value'>{quality}</Text>
            <View
              className='step-btn'
              onClick={() => setQuality(q => Math.min(100, q + 5))}>
              <Text>+</Text>
            </View>
          </View>
          <Text className='settings-title'>输出格式</Text>
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
                <Text>{label}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : (
        <Text className='stitch-tip'>
          按当前列表顺序横向拼接，高度对齐最短边，输出 PNG 并保存到相册。
        </Text>
      )}

      {log ? (
        <Text className='log'>{log}</Text>
      ) : (
        <Text className='log log-empty'>处理结果将显示在这里</Text>
      )}

      <View className='footer'>
        <View
          className={`btn-orange ${busy ? 'btn-orange-disabled' : ''}`}
          onClick={runJob}>
          <Text>{runLabel}</Text>
        </View>
        <View className='btn-ghost' onClick={clearAll}>
          <Text>清空</Text>
        </View>
      </View>

      <Canvas type='2d' id={CANVAS_ID} className='hidden-canvas' />
    </View>
  );
}
