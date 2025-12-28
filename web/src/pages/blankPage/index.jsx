import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * BlankPage 空白页
 * 用于页面跳转后，显示空白页，防止页面闪烁
 * @returns {React.ReactNode} 空白页
 */
export const BlankPage = () => {
    const navigate = useNavigate()
    useEffect(() => {
        const timer = setTimeout(() => {
            navigate(-1)
        }, 0)
        return () => clearTimeout(timer)
    }, [])

    return (
        <div>123</div>
    //   <div />
    )
}
