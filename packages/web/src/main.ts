import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'
import App from './App.vue'
import HomeView from './views/HomeView.vue'
import PresentView from './views/PresentView.vue'
import './style.css'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: HomeView },
    { path: '/present', component: PresentView, meta: { bare: true } },
    // settings is a sheet over the timeline now; keep the old deep link working
    { path: '/settings', redirect: (to) => ({ path: '/', query: { ...to.query, settings: '1' } }) },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

createApp(App).use(createPinia()).use(router).mount('#app')
