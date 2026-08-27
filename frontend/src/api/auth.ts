import client from './client'

export const login = (username: string, password: string) =>
  client.post('/auth/login', { username, password })

export const getMe = () => client.get('/auth/me')
