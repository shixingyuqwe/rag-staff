import { Button, Card, Input, message as antdMessage } from 'antd';
import { useState } from 'react';
import styles from './index.module.css';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = () => {
    antdMessage.info('登录功能暂未接入');
  };

  return (
    <div className={styles.container}>
      <Card className={styles.loginBox}>
        <h2 className={styles.title}>人事管理系统</h2>
        <Input
          placeholder="用户名"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          size="large"
          style={{ marginBottom: 16 }}
        />
        <Input.Password
          placeholder="密码"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          size="large"
          style={{ marginBottom: 24 }}
        />
        <Button type="primary" block size="large" onClick={handleLogin}>
          登录
        </Button>
      </Card>
    </div>
  );
}
