"use client";

import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";

type Props = {
  action: (formData: FormData) => Promise<{ ok: boolean; message?: string }>;
  className?: string;
};

function SubmitInner({ className }: { className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? "Cancelling..." : "Cancel subscription"}
    </button>
  );
}

export function CancelButton({ action, className }: Props) {
  const router = useRouter();

  const clientAction = async (formData: FormData) => {
    const res = await action(formData);
    if (!res.ok) throw new Error(res.message ?? "Cancel failed");
    router.refresh();
  };

  return (
    <form action={clientAction}>
      <SubmitInner className={className} />
    </form>
  );
}
