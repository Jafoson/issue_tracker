"use client"

import { Avatar, AvatarData } from '@/components/ui/atoms/Avatar/Avatar';
import { Button } from '@/components/ui/atoms/Button/Button';
import styles from './UserMenu.module.scss';
import { Icon } from '@iconify/react';


interface UserMenuClientProps {
  me: AvatarData;
}

function UserMenuClient({ me }: UserMenuClientProps) {
  return (
      <Button
        variant="elevated"
        full
        textAlign="left"
        style={{height: "48px", borderRadius: "var(--radius)"}}
      >
        <Avatar avatar={me} size={28} />
        <span
          className={styles.content}
        >
          <span
            className={styles.title}
          >
            {me.name}
          </span>
            <Button
              variant="ghost"
              size="sm"
              icon={<Icon icon="lucide:bell" height={20} />}
              />
        </span>
      </Button>
  )
}

export default UserMenuClient