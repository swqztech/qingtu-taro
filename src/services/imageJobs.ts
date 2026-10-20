import Taro from '@tarojs/taro';

import type { OutputFormat } from '../models/OutputFormat';

export type PickedImage = { path: string; name: string };

export type CompressLine = {
  name: string;
  before: number;
  after: number;
  outPath: string;
  ok: boolean;
  message?: string;
};

function fileName(path: string): string {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] ?? path;
}

/** 小程序 compressImage；H5 回退为原图路径 */
export async function compressOne(
  src: string,
  quality: number,
  format: OutputFormat,
): Promise<CompressLine> {
  const name = fileName(src);
  try {
    const stat = await Taro.getFileInfo({ filePath: src });
    const before = stat.size;
    if (process.env.TARO_ENV === 'h5') {
      return {
        name,
        before,
        after: before,
        outPath: src,
        ok: true,
        message: 'H5 请用浏览器保存；压缩以小程序端为准',
      };
    }
    const q = Math.max(1, Math.min(100, quality));
    const res = await Taro.compressImage({
      src,
      quality: q,
      compressedWidth: undefined,
      compressedHeight: undefined,
    });
    const outPath = res.tempFilePath;
    const outStat = await Taro.getFileInfo({ filePath: outPath });
    let message = '完成';
    if (format === 'jpeg') {
      message += '（输出为 JPEG 临时文件）';
    }
    return {
      name,
      before,
      after: outStat.size,
      outPath,
      ok: true,
      message,
    };
  } catch (e) {
    return {
      name,
      before: 0,
      after: 0,
      outPath: '',
      ok: false,
      message: String(e),
    };
  }
}

/** 横向拼接：Canvas 2D，输出 PNG 临时路径 */
export async function stitchHorizontal(
  paths: string[],
  canvasId: string,
): Promise<string> {
  if (paths.length < 2) {
    throw new Error('拼接需要至少 2 张图');
  }
  const infos = await Promise.all(
    paths.map(p => Taro.getImageInfo({ src: p })),
  );
  const targetH = Math.min(...infos.map(i => i.height));
  const scaled = infos.map(info => {
    const w = Math.max(1, Math.round((info.width * targetH) / info.height));
    return { path: info.path, width: w, height: targetH };
  });
  const totalW = scaled.reduce((s, i) => s + i.width, 0);

  return new Promise((resolve, reject) => {
    const query = Taro.createSelectorQuery();
    query
      .select(`#${canvasId}`)
      .fields({ node: true, size: true })
      .exec(async res => {
        try {
          const canvas = res[0]?.node as {
            width: number;
            height: number;
            getContext: (t: string) => CanvasRenderingContext2D;
            createImage: () => HTMLImageElement;
          };
          if (!canvas) {
            reject(new Error('Canvas 未就绪'));
            return;
          }
          canvas.width = totalW;
          canvas.height = targetH;
          const ctx = canvas.getContext('2d');
          let x = 0;
          for (const piece of scaled) {
            const img = canvas.createImage();
            await new Promise<void>((ok, fail) => {
              img.onload = () => ok();
              img.onerror = () => fail(new Error('图片加载失败'));
              img.src = piece.path;
            });
            ctx.drawImage(img, x, 0, piece.width, piece.height);
            x += piece.width;
          }
          Taro.canvasToTempFilePath({
            canvas,
            fileType: 'png',
            success: r => resolve(r.tempFilePath),
            fail: e => reject(e),
          });
        } catch (e) {
          reject(e);
        }
      });
  });
}

export function formatCompressLog(lines: CompressLine[]): string {
  return lines
    .map(l => {
      if (!l.ok) {
        return `${l.name}: ${l.message}`;
      }
      const ratio =
        l.before > 0
          ? `${((1 - l.after / l.before) * 100).toFixed(1)}%`
          : '-';
      return `${l.name}: ${l.before} → ${l.after} (${ratio})`;
    })
    .join('\n');
}
