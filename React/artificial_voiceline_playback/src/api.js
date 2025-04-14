import axios from 'axios'; 

const api = axios.create({
  baseURL: 'http://localhost:8060/',
});

export default api;