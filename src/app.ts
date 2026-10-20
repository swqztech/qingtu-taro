import { PropsWithChildren } from 'react';
import { useLaunch } from '@tarojs/taro';

import './app.scss';

function App({ children }: PropsWithChildren) {
  useLaunch(() => {
    console.log('轻图 Taro 启动');
  });
  return children;
}

export default App;
