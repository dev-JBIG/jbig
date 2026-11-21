import React, { useEffect, useRef } from 'react';
import { Button } from '@primer/react';
import './AlertModal.css';
import { useFocusTrap } from './useFocusTrap';

interface AlertModalProps {
    show: boolean;
    message: string;
    onClose: () => void;
    title?: string;
    type?: 'info' | 'success' | 'warning' | 'error' | 'danger';
    // Confirm 모드 옵션
    isConfirm?: boolean;
    onConfirm?: () => void;
    confirmText?: string;
    cancelText?: string;
}

const AlertModal: React.FC<AlertModalProps> = ({
    show,
    message,
    onClose,
    title = '알림',
    type = 'info',
    isConfirm = false,
    onConfirm,
    confirmText = '확인',
    cancelText = '취소'
}) => {
    const modalRef = useRef<HTMLDivElement>(null);
    const primaryBtnRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (show) {
            document.body.classList.add('modal-open');
        } else {
            document.body.classList.remove('modal-open');
        }

        return () => {
            document.body.classList.remove('modal-open');
        };
    }, [show]);

    useFocusTrap(modalRef, show, { onClose, initialFocusRef: primaryBtnRef });

    const handleConfirm = () => {
        if (isConfirm && onConfirm) {
            onConfirm();
            return;
        }
        onClose();
    };

    if (!show) return null;

    const getIconByType = () => {
        switch (type) {
            case 'success':
                return (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                        <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                );
            case 'warning':
                return (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                        <line x1="12" y1="9" x2="12" y2="13"></line>
                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                );
            case 'error':
            case 'danger':
                return (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                );
            default:
                return (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="16" x2="12" y2="12"></line>
                        <line x1="12" y1="8" x2="12.01" y2="8"></line>
                    </svg>
                );
        }
    };

    const toneClass =
        type === 'success'
            ? 'is-success'
            : type === 'warning'
                ? 'is-warning'
                : type === 'error' || type === 'danger'
                    ? 'is-danger'
                    : 'is-info';

    return (
        <div
            className="alert-modal-overlay"
            onClick={onClose}
            tabIndex={-1}
            role="dialog"
            aria-labelledby="alertModalLabel"
            aria-modal="true"
            ref={modalRef}
        >
            <div
                className="alert-modal-card"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="alert-modal-header">
                    <div className={`alert-modal-icon ${toneClass}`}>
                        {getIconByType()}
                    </div>
                    <div className="alert-modal-title" id="alertModalLabel">{title}</div>
                </div>

                <div className="alert-modal-desc">{message}</div>

                <div className="alert-modal-button-group">
                    {isConfirm ? (
                        <>
                            <Button
                                type="button"
                                variant="default"
                                onClick={onClose}
                            >
                                {cancelText}
                            </Button>
                            <Button
                                ref={primaryBtnRef}
                                type="button"
                                variant={type === 'danger' ? 'danger' : 'primary'}
                                onClick={handleConfirm}
                            >
                                {confirmText}
                            </Button>
                        </>
                    ) : (
                        <Button
                            ref={primaryBtnRef}
                            type="button"
                            variant="primary"
                            onClick={onClose}
                        >
                            확인
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AlertModal;
