import LoginForm from '@/components/Auth/LoginForm'

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-[#f9f506] rounded-xl mb-4">
            <span className="text-xl font-black text-gray-900">A</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Atlas Eye CRM</h1>
          <p className="text-gray-500 text-sm mt-1">Entre na sua conta</p>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
