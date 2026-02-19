import { useState, useEffect, RefObject } from 'react';

/**
 * Кастомный хук для отслеживания ширины элемента
 * @param ref - Ref объект целевого элемента
 * @returns Текущая ширина элемента в пикселях
 */
export function useElementWidth<T extends HTMLElement = HTMLElement>(
  ref: RefObject<T>
): number | undefined {
  const [width, setWidth] = useState<number | undefined>(undefined);

  useEffect(() => {
    // Функция для обновления ширины
    const updateWidth = () => {
      if (ref.current) {
        const newWidth = ref.current.getBoundingClientRect().width;
        setWidth(newWidth);
      }
    };

    // Получаем текущий элемент
    const element = ref.current;

    if (!element) {
      return;
    }

    // Устанавливаем начальную ширину
    updateWidth();

    // Создаем ResizeObserver для отслеживания изменений размера
    const resizeObserver = new ResizeObserver((entries) => {
      // Используем requestAnimationFrame для оптимизации производительности
      window.requestAnimationFrame(() => {
        if (!Array.isArray(entries) || !entries.length) {
          return;
        }
        updateWidth();
      });
    });

    // Начинаем наблюдение за элементом
    resizeObserver.observe(element);

    // Очистка при размонтировании или изменении ref
    return () => {
      resizeObserver.disconnect();
    };
  }, [ref]); // Зависимость от ref

  return width;
}