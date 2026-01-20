import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { createRouter, createWebHistory } from 'vue-router';
import App from './App.vue';

// Vue Flow styles
import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';
import '@vue-flow/controls/dist/style.css';
import '@vue-flow/minimap/dist/style.css';

// App styles
import './styles/main.css';

// Routes
const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('./views/Home.vue'),
    },
    {
      path: '/flows',
      name: 'flows',
      component: () => import('./views/Flows.vue'),
    },
    {
      path: '/flows/new',
      name: 'flow-new',
      component: () => import('./views/FlowEditor.vue'),
    },
    {
      path: '/flows/:id',
      name: 'flow-edit',
      component: () => import('./views/FlowEditor.vue'),
    },
    {
      path: '/blocks',
      name: 'blocks',
      component: () => import('./views/Blocks.vue'),
    },
    {
      path: '/sources',
      name: 'sources',
      component: () => import('./views/Sources.vue'),
    },
  ],
});

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);

app.mount('#app');
