import { useEffect, useRef } from "react";

const QueueConfirmDialog = ({
  confirmation,
  onCancel,
  onConfirm,
}) => {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!confirmation || !dialog) return;

    if (!dialog.open) {
      dialog.showModal();
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      if (dialog.open) {
        dialog.close();
      }

      document.body.style.overflow = previousOverflow;
    };
  }, [confirmation]);

  return (
    <dialog
      ref={dialogRef}
      className="queue-confirm-dialog"
      aria-labelledby="queue-confirm-title"
      aria-describedby="queue-confirm-description"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      <p className="queue-confirm-eyebrow">
        EASYRIDE TERMINAL OPERATIONS
      </p>

      <h2 id="queue-confirm-title">
        Confirm Trip Update
      </h2>

      <p id="queue-confirm-description">
        {confirmation?.message}
      </p>

      <div className="queue-confirm-actions">
        <button
          type="button"
          className="queue-confirm-cancel"
          onClick={onCancel}
          autoFocus
        >
          Cancel
        </button>

        <button
          type="button"
          className="queue-confirm-submit"
          onClick={onConfirm}
        >
          Confirm
        </button>
      </div>
    </dialog>
  );
};

export default QueueConfirmDialog;