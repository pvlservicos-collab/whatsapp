/**
 * NextAuth v5 — substitui Supabase Auth
 *
 * Estratégia: Credentials (email + password com bcrypt)
 * Sessão: JWT armazenado em cookie HttpOnly
 */
import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { db } from './db'
import { users, profiles } from './schema'

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Senha', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const email = (credentials.email as string).toLowerCase().trim()
        const password = credentials.password as string

        // Buscar usuário pelo email
        const [user] = await db
          .select({
            id: users.id,
            email: users.email,
            passwordHash: users.passwordHash,
            fullName: profiles.fullName,
            avatarUrl: profiles.avatarUrl,
            isSuperadmin: profiles.isSuperadmin,
          })
          .from(users)
          .leftJoin(profiles, eq(profiles.id, users.id))
          .where(eq(users.email, email))
          .limit(1)

        if (!user) return null

        const valid = await bcrypt.compare(password, user.passwordHash)
        if (!valid) return null

        return {
          id: user.id,
          email: user.email,
          name: user.fullName || user.email,
          image: user.avatarUrl,
          isSuperadmin: user.isSuperadmin || false,
        }
      },
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.isSuperadmin = (user as any).isSuperadmin || false
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        ;(session.user as any).isSuperadmin = token.isSuperadmin as boolean
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  secret: process.env.AUTH_SECRET,
})
