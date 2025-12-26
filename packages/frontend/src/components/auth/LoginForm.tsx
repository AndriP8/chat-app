import { AlertCircle, Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react';
import { type FormEvent, useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { ZodError } from 'zod';
import { type LoginInput, loginSchema } from '@/schemas/auth';
import type { ValidationError } from '@/types';
import { getErrorMessage } from '@/utils/helpers';
import { useAuth } from './AuthContext';

interface LoginFormProps {
  onLoginSuccess?: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onLoginSuccess }) => {
  const { login, authState, clearError } = useAuth();
  const [formData, setFormData] = useState<LoginInput>({
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Handle input changes
  const handleInputChange = useCallback(
    (field: keyof LoginInput, value: string) => {
      setFormData((prev: LoginInput) => ({ ...prev, [field]: value }));

      // Clear validation errors for the field being edited
      setValidationErrors((prev) => prev.filter((error) => error.field !== field));

      // Clear auth errors when user starts typing
      if (authState.error) {
        clearError();
      }
    },
    [authState.error, clearError]
  );

  // Validate form using Zod
  const validateForm = useCallback((): boolean => {
    try {
      loginSchema.parse(formData);
      setValidationErrors([]);
      return true;
    } catch (error) {
      if (error instanceof ZodError) {
        const errors: ValidationError[] = error.errors.map((err) => ({
          field: err.path[0] as string,
          message: err.message,
        }));
        setValidationErrors(errors);
      }
      return false;
    }
  }, [formData]);

  // Handle form submission
  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      if (!validateForm() || isSubmitting) {
        return;
      }

      setIsSubmitting(true);

      try {
        await login(formData);
        onLoginSuccess?.();
      } catch (error) {
        // Error is already handled by AuthContext
        console.error('Login failed:', getErrorMessage(error));
      } finally {
        setIsSubmitting(false);
      }
    },
    [formData, validateForm, isSubmitting, login, onLoginSuccess]
  );

  // Get field error
  const getFieldError = useCallback(
    (field: string): string | undefined => {
      return validationErrors.find((error) => error.field === field)?.message;
    },
    [validationErrors]
  );

  // Toggle password visibility
  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
  };

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="rounded-lg bg-white p-8 shadow-lg dark:bg-gray-800">
        <div className="mb-8 text-center">
          <h1 className="mb-2 font-bold text-2xl text-gray-900 dark:text-white">Welcome Back</h1>
          <p className="text-gray-600 dark:text-gray-400">Sign in to your account to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email Field */}
          <div>
            <label
              htmlFor="email"
              className="mb-2 block font-medium text-gray-700 text-sm dark:text-gray-300"
            >
              Email Address
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Mail className="h-5 w-5 text-gray-400" />
              </div>
              <input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className={`block w-full rounded-lg border py-3 pr-3 pl-10 transition-colors duration-200 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  getFieldError('email')
                    ? 'border-red-300 bg-red-50 dark:border-red-500 dark:bg-red-900/20'
                    : 'border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-700'
                }text-gray-900 placeholder-gray-500 dark:placeholder-gray-400`}
                placeholder="Enter your email"
                autoComplete="email"
                disabled={isSubmitting}
              />
            </div>
            {getFieldError('email') && (
              <p className="mt-2 flex items-center text-red-600 text-sm dark:text-red-400">
                <AlertCircle className="mr-1 h-4 w-4" />
                {getFieldError('email')}
              </p>
            )}
          </div>

          {/* Password Field */}
          <div>
            <label
              htmlFor="password"
              className="mb-2 block font-medium text-gray-700 text-sm dark:text-gray-300"
            >
              Password
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Lock className="h-5 w-5 text-gray-400" />
              </div>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                className={`block w-full rounded-lg border py-3 pr-12 pl-10 transition-colors duration-200 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  getFieldError('password')
                    ? 'border-red-300 bg-red-50 dark:border-red-500 dark:bg-red-900/20'
                    : 'border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-700'
                }text-gray-900 placeholder-gray-500 dark:placeholder-gray-400`}
                placeholder="Enter your password"
                autoComplete="current-password"
                disabled={isSubmitting}
              />
              <button
                type="button"
                onClick={togglePasswordVisibility}
                className="absolute inset-y-0 right-0 flex items-center pr-3 transition-colors hover:text-gray-600 dark:hover:text-gray-300"
                disabled={isSubmitting}
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5 text-gray-400" />
                ) : (
                  <Eye className="h-5 w-5 text-gray-400" />
                )}
              </button>
            </div>
            {getFieldError('password') && (
              <p className="mt-2 flex items-center text-red-600 text-sm dark:text-red-400">
                <AlertCircle className="mr-1 h-4 w-4" />
                {getFieldError('password')}
              </p>
            )}
          </div>

          {/* Auth Error */}
          {authState.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
              <div className="flex items-center">
                <AlertCircle className="mr-2 h-5 w-5 text-red-500" />
                <p className="text-red-700 text-sm dark:text-red-400">{authState.error}</p>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || authState.isLoading}
            className="flex w-full items-center justify-center rounded-lg border border-transparent bg-blue-600 px-4 py-3 font-medium text-sm text-white transition-colors duration-200 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting || authState.isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing In...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {/* Demo Account Link */}
        <div className="mt-6 text-center">
          <p className="text-gray-600 text-sm dark:text-gray-400">
            Don&apos;t have an account?{' '}
            <Link
              to="/"
              className="font-medium text-blue-600 transition-colors hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Generate demo accounts
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
