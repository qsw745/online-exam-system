import { useEffect } from 'react'
import { useNavigation } from 'react-router-dom'
import NProgress from 'nprogress'

NProgress.configure({ showSpinner: false, trickleSpeed: 120 })

export default function RouteProgress() {
  const navigation = useNavigation()

  useEffect(() => {
    if (navigation.state === 'loading') NProgress.start()
    else NProgress.done()
  }, [navigation.state])

  return null
}
