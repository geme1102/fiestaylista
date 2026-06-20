import type { Page, Locator } from '@playwright/test';
import { ROUTES } from '../config/constants';
import { ToastPageObject } from './components/toast.po';
import { ModalPageObject } from './components/modal.po';

export class DashboardPage {
  readonly toast: ToastPageObject;
  readonly modal: ModalPageObject;

  constructor(private page: Page) {
    this.toast = new ToastPageObject(page);
    this.modal = new ModalPageObject(page);
  }

  async goto() {
    await this.page.goto(ROUTES.dashboard);
  }

  get newEventButton() {
    return this.page.locator('[data-testid="new-event-button"]');
  }

  getStat(stat: 'events' | 'gifts' | 'raised') {
    return this.page.locator(`[data-testid="stat-${stat}"]`);
  }

  getEventCard(eventId: string) {
    return this.page.locator(`[data-testid="event-card-${eventId}"]`);
  }

  getCreateEventButton(type: string) {
    return this.page.locator(`[data-testid="create-event-${type}"]`);
  }

  getCopyLinkButton(eventTitle: string) {
    return this.page.locator(`button[aria-label="Copiar enlace de ${eventTitle}"]`);
  }

  getDeleteButton(eventTitle: string) {
    return this.page.locator(`button[aria-label="Eliminar ${eventTitle}"]`);
  }

  get emptyState() {
    return this.page.getByText('¿Qué evento quieres crear?');
  }

  async clickNewEvent() {
    await this.newEventButton.click();
  }

  async createEvent(eventType: string, title: string) {
    await this.getCreateEventButton(eventType).click();
    await this.page.fill('#title', title);
    await this.page.click('button[type="submit"]');
  }

  async deleteEvent(eventTitle: string) {
    await this.getDeleteButton(eventTitle).click();
    await this.modal.waitForVisible();
    await this.modal.confirm();
  }
}
