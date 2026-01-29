import axios from 'axios';
import crypto from 'crypto';

const axiosConfig = {
  timeout: 10000,
};

export const digest = async (url, method, username, password) => {
  console.log(url);
  try {
    await axios.put(url, axiosConfig);
  } catch (err) {
    if (!err.response || !err.response.headers) {
      console.error('Ошибка запроса или отсутствие заголовков в ответе');
      return;
    }

    const authenticateHeader = err.response.headers['www-authenticate'];
    if (!authenticateHeader) {
      console.error('Заголовок www-authenticate отсутствует');
      return;
    }

    // Функция для извлечения параметров аутентификации из заголовка
    const parseParams = (header) => {
      const params = {};
      const regex = /([a-zA-Z0-9_-]+)="([^"]*)"/g;
      let match;
      while ((match = regex.exec(header)) !== null) {
        params[match[1]] = match[2];
      }
      return params;
    };

    // Функция для вычисления значения параметра аутентификации
    const calculateAuthValue = (params, method, uri, username, password) => {
      const A1 = `${username}:${params.realm}:${password}`;
      const A2 = `${method}:${uri}`;
      const HA1 = crypto.createHash('md5').update(A1).digest('hex');
      const HA2 = crypto.createHash('md5').update(A2).digest('hex');
      const response = crypto
        .createHash('md5')
        .update(
          `${HA1}:${params.nonce}:${params.nc}:${params.cnonce}:${params.qop}:${HA2}`
        )
        .digest('hex');
      return `Digest username="${username}", realm="${params.realm}", nonce="${params.nonce}", uri="${uri}", qop=${params.qop}, nc=${params.nc}, cnonce="${params.cnonce}", response="${response}"`;
    };

    // Разбор параметров аутентификации
    const authParams = parseParams(authenticateHeader);

    const authHeaderValue = calculateAuthValue(
      authParams,
      method,
      url,
      username,
      password
    );

    return authHeaderValue;
  }
};

export default digest;
