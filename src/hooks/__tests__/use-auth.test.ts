import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAuth } from "@/hooks/use-auth";
import { signIn as signInAction, signUp as signUpAction } from "@/actions";
import { getAnonWorkData, clearAnonWork } from "@/lib/anon-work-tracker";
import { getProjects } from "@/actions/get-projects";
import { createProject } from "@/actions/create-project";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/actions", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: vi.fn(),
  clearAnonWork: vi.fn(),
}));

vi.mock("@/actions/get-projects", () => ({
  getProjects: vi.fn(),
}));

vi.mock("@/actions/create-project", () => ({
  createProject: vi.fn(),
}));

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getAnonWorkData as any).mockReturnValue(null);
    (getProjects as any).mockResolvedValue([]);
    (createProject as any).mockResolvedValue({ id: "new-project-id" });
  });

  describe("initial state", () => {
    test("isLoading starts as false", () => {
      const { result } = renderHook(() => useAuth());
      expect(result.current.isLoading).toBe(false);
    });

    test("exposes signIn and signUp functions", () => {
      const { result } = renderHook(() => useAuth());
      expect(typeof result.current.signIn).toBe("function");
      expect(typeof result.current.signUp).toBe("function");
    });
  });

  describe("signIn", () => {
    test("calls signInAction with email and password", async () => {
      (signInAction as any).mockResolvedValue({ success: true });

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("test@example.com", "password123");
      });

      expect(signInAction).toHaveBeenCalledWith("test@example.com", "password123");
    });

    test("returns the result from signInAction", async () => {
      const authResult = { success: false, error: "Invalid credentials" };
      (signInAction as any).mockResolvedValue(authResult);

      const { result } = renderHook(() => useAuth());
      let returnedResult: any;
      await act(async () => {
        returnedResult = await result.current.signIn("test@example.com", "wrong");
      });

      expect(returnedResult).toEqual(authResult);
    });

    test("sets isLoading to true during call and false after", async () => {
      let resolveSignIn!: (value: any) => void;
      const pendingSignIn = new Promise((resolve) => {
        resolveSignIn = resolve;
      });
      (signInAction as any).mockReturnValue(pendingSignIn);

      const { result } = renderHook(() => useAuth());

      let signInPromise: Promise<any>;
      act(() => {
        signInPromise = result.current.signIn("test@example.com", "password123");
      });

      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        resolveSignIn({ success: false, error: "Invalid" });
        await signInPromise;
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("resets isLoading to false even when signInAction throws", async () => {
      (signInAction as any).mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("test@example.com", "password123").catch(() => {});
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("does not navigate when sign in fails", async () => {
      (signInAction as any).mockResolvedValue({ success: false, error: "Invalid credentials" });

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("test@example.com", "wrong");
      });

      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe("signUp", () => {
    test("calls signUpAction with email and password", async () => {
      (signUpAction as any).mockResolvedValue({ success: true });

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signUp("new@example.com", "password123");
      });

      expect(signUpAction).toHaveBeenCalledWith("new@example.com", "password123");
    });

    test("returns the result from signUpAction", async () => {
      const authResult = { success: false, error: "Email already registered" };
      (signUpAction as any).mockResolvedValue(authResult);

      const { result } = renderHook(() => useAuth());
      let returnedResult: any;
      await act(async () => {
        returnedResult = await result.current.signUp("existing@example.com", "password123");
      });

      expect(returnedResult).toEqual(authResult);
    });

    test("sets isLoading to true during call and false after", async () => {
      let resolveSignUp!: (value: any) => void;
      const pendingSignUp = new Promise((resolve) => {
        resolveSignUp = resolve;
      });
      (signUpAction as any).mockReturnValue(pendingSignUp);

      const { result } = renderHook(() => useAuth());

      let signUpPromise: Promise<any>;
      act(() => {
        signUpPromise = result.current.signUp("new@example.com", "password123");
      });

      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        resolveSignUp({ success: false });
        await signUpPromise;
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("resets isLoading to false even when signUpAction throws", async () => {
      (signUpAction as any).mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signUp("new@example.com", "password123").catch(() => {});
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("does not navigate when sign up fails", async () => {
      (signUpAction as any).mockResolvedValue({ success: false, error: "Email already registered" });

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signUp("existing@example.com", "password123");
      });

      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe("post-authentication navigation", () => {
    describe("when anonymous work exists with messages", () => {
      const anonWork = {
        messages: [{ id: "1", role: "user", content: "Hello" }],
        fileSystemData: { "/App.tsx": { content: "export default () => <div />" } },
      };

      beforeEach(() => {
        (getAnonWorkData as any).mockReturnValue(anonWork);
        (createProject as any).mockResolvedValue({ id: "anon-project-id" });
      });

      test("creates a project with the anon work data", async () => {
        (signInAction as any).mockResolvedValue({ success: true });

        const { result } = renderHook(() => useAuth());
        await act(async () => {
          await result.current.signIn("test@example.com", "password123");
        });

        expect(createProject).toHaveBeenCalledWith(
          expect.objectContaining({
            messages: anonWork.messages,
            data: anonWork.fileSystemData,
          })
        );
      });

      test("clears anon work after creating the project", async () => {
        (signInAction as any).mockResolvedValue({ success: true });

        const { result } = renderHook(() => useAuth());
        await act(async () => {
          await result.current.signIn("test@example.com", "password123");
        });

        expect(clearAnonWork).toHaveBeenCalled();
      });

      test("navigates to the newly created project", async () => {
        (signInAction as any).mockResolvedValue({ success: true });

        const { result } = renderHook(() => useAuth());
        await act(async () => {
          await result.current.signIn("test@example.com", "password123");
        });

        expect(mockPush).toHaveBeenCalledWith("/anon-project-id");
      });

      test("does not fetch existing projects", async () => {
        (signInAction as any).mockResolvedValue({ success: true });

        const { result } = renderHook(() => useAuth());
        await act(async () => {
          await result.current.signIn("test@example.com", "password123");
        });

        expect(getProjects).not.toHaveBeenCalled();
      });
    });

    describe("when anon work has no messages", () => {
      test("falls through to the existing-projects path", async () => {
        (getAnonWorkData as any).mockReturnValue({ messages: [], fileSystemData: {} });
        (signInAction as any).mockResolvedValue({ success: true });
        (getProjects as any).mockResolvedValue([{ id: "existing-project" }]);

        const { result } = renderHook(() => useAuth());
        await act(async () => {
          await result.current.signIn("test@example.com", "password123");
        });

        expect(mockPush).toHaveBeenCalledWith("/existing-project");
        expect(createProject).not.toHaveBeenCalled();
      });
    });

    describe("when there is no anonymous work", () => {
      test("navigates to the most recent project when projects exist", async () => {
        (signInAction as any).mockResolvedValue({ success: true });
        (getProjects as any).mockResolvedValue([
          { id: "recent-project", name: "Recent" },
          { id: "older-project", name: "Older" },
        ]);

        const { result } = renderHook(() => useAuth());
        await act(async () => {
          await result.current.signIn("test@example.com", "password123");
        });

        expect(mockPush).toHaveBeenCalledWith("/recent-project");
        expect(createProject).not.toHaveBeenCalled();
      });

      test("creates a blank project and navigates to it when no projects exist", async () => {
        (signInAction as any).mockResolvedValue({ success: true });
        (getProjects as any).mockResolvedValue([]);
        (createProject as any).mockResolvedValue({ id: "brand-new-project" });

        const { result } = renderHook(() => useAuth());
        await act(async () => {
          await result.current.signIn("test@example.com", "password123");
        });

        expect(createProject).toHaveBeenCalledWith(
          expect.objectContaining({ messages: [], data: {} })
        );
        expect(mockPush).toHaveBeenCalledWith("/brand-new-project");
      });
    });

    describe("after sign up", () => {
      test("runs the same post-auth navigation flow on success", async () => {
        (signUpAction as any).mockResolvedValue({ success: true });
        (getProjects as any).mockResolvedValue([{ id: "first-project" }]);

        const { result } = renderHook(() => useAuth());
        await act(async () => {
          await result.current.signUp("new@example.com", "password123");
        });

        expect(mockPush).toHaveBeenCalledWith("/first-project");
      });
    });
  });
});
